/**
 * Technology Joint Studio API — Cloudflare Worker
 * ----------------------------------------------
 * Handles GitHub OAuth (authorization-code flow) for the static Studio,
 * then proxies GitHub REST calls so the access token NEVER ships to the
 * browser. The token is stored in an HttpOnly, Secure, SameSite=Lax
 * session cookie, encrypted with AES-GCM using a secret key.
 *
 * Routes:
 *   GET  /api/auth/login     -> redirect to GitHub authorize (CSRF state)
 *   GET  /api/auth/callback  -> exchange code, set session cookie, redirect
 *   GET  /api/auth/session   -> return { authenticated, user? } (CORS+creds)
 *   POST /api/auth/logout    -> clear session cookie
 *   GET/PUT/DELETE /api/gh/* -> proxy to https://api.github.com/*
 *
 * Secrets (wrangler secret put):
 *   GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET, COOKIE_SECRET
 * Vars (wrangler.toml [vars]):
 *   SITE_ORIGIN, SITE_BASE, DEFAULT_OWNER, DEFAULT_REPO, DEFAULT_BRANCH
 */

const GH_AUTHORIZE = "https://github.com/login/oauth/authorize";
const GH_TOKEN = "https://github.com/login/oauth/access_token";
const GH_API = "https://api.github.com";
const SESSION_COOKIE = "ttj_studio_session";
const STATE_COOKIE = "ttj_studio_state";
const SESSION_TTL_SECONDS = 30 * 24 * 60 * 60; // 30 days

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;

    // CORS preflight for the static site origin
    if (request.method === "OPTIONS") return cors(preflight(), request, env);

    try {
      if (path === "/api/auth/login") return handleLogin(request, env);
      if (path === "/api/auth/callback") return handleCallback(request, env);
      if (path === "/api/auth/session") return handleSession(request, env);
      if (path === "/api/auth/logout") return handleLogout(request, env);
      if (path.startsWith("/api/gh/")) return handleProxy(request, env, path);
      return cors(json({ error: "Not found" }, 404), request, env);
    } catch (err) {
      return cors(
        json({ error: err instanceof Error ? err.message : "Internal error" }, 500),
        request,
        env,
      );
    }
  },
};

/* ---------------------------------------------------------------- */
/* Auth flow                                                         */
/* ---------------------------------------------------------------- */

async function handleLogin(request, env) {
  const url = new URL(request.url);
  // Allow deep links: after OAuth, bounce back to the studio page the user
  // came from (e.g. /studio/editor?slug=...). The `next` value is stored in
  // the HttpOnly state cookie so it cannot be tampered with by the browser.
  // It is validated against SITE_ORIGIN to prevent open-redirect phishing.
  const requestedNext = url.searchParams.get("next");
  const next = safeNext(env, requestedNext) || defaultStudioUrl(env);
  const state = randomHex(16);

  const authorize = new URL(GH_AUTHORIZE);
  authorize.searchParams.set("client_id", env.GITHUB_CLIENT_ID);
  authorize.searchParams.set("redirect_uri", callbackUrl(url.origin));
  // repo scope = full read/write on the blog repo (OAuth apps use classic scopes)
  authorize.searchParams.set("scope", "repo");
  authorize.searchParams.set("state", state);

  const stateValue = `${state}|${next}`;
  const headers = new Headers({ Location: authorize.toString() });
  headers.append(
    "Set-Cookie",
    `${STATE_COOKIE}=${encodeURIComponent(stateValue)}; Path=/; Secure; SameSite=Lax; Max-Age=600; HttpOnly`,
  );
  return cors(new Response(null, { status: 302, headers }), request, env);
}

async function handleCallback(request, env) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const cookieState = readCookie(request.headers.get("Cookie"), STATE_COOKIE);

  // CSRF check: state must match the token we set in /login. The cookie also
  // carries the `next` redirect target (state|cookie|"|"|next).
  const statePayload = cookieState ? decodeURIComponent(cookieState) : "";
  const [csrfToken, nextTarget] = statePayload.split("|");
  if (!code || !csrfToken || state !== csrfToken) {
    return Response.redirect(defaultStudioUrl(env), 302);
  }

  // Exchange code for access token (server-side only)
  const tokenRes = await fetch(GH_TOKEN, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      client_id: env.GITHUB_CLIENT_ID,
      client_secret: env.GITHUB_CLIENT_SECRET,
      code,
      redirect_uri: callbackUrl(url.origin),
    }),
  });
  const tokenData = await tokenRes.json();

  if (!tokenData.access_token) {
    return Response.redirect(nextTarget || defaultStudioUrl(env), 302);
  }

  // Fetch identity for the session payload (login/name/avatar)
  const userRes = await fetch(`${GH_API}/user`, {
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${tokenData.access_token}`,
      "X-GitHub-Api-Version": "2022-11-28",
    },
  });
  const user = userRes.ok ? await userRes.json() : null;

  const session = {
    token: tokenData.access_token,
    scope: tokenData.scope || "repo",
    user: user
      ? { login: user.login, name: user.name || user.login, avatar_url: user.avatar_url }
      : null,
    exp: Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS,
  };

  const encrypted = await encryptSession(env, session);
  const headers = new Headers({
    Location: nextTarget || defaultStudioUrl(env),
    "Set-Cookie": [
      `${SESSION_COOKIE}=${encrypted}; Path=/; Secure; SameSite=Lax; Max-Age=${SESSION_TTL_SECONDS}; HttpOnly`,
      `${STATE_COOKIE}=; Path=/; Secure; SameSite=Lax; Max-Age=0; HttpOnly`,
    ].join(", "),
  });
  return cors(new Response(null, { status: 302, headers }), request, env);
}

async function handleSession(request, env) {
  const session = await readSession(request, env);

  if (!session) {
    return cors(json({ authenticated: false }, 200), request, env);
  }

  // Verify the token still works against GitHub
  const userRes = await fetch(`${GH_API}/user`, {
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${session.token}`,
      "X-GitHub-Api-Version": "2022-11-28",
    },
  });

  if (!userRes.ok) {
    return cors(json({ authenticated: false }, 200), request, env);
  }

  const user = await userRes.json();
  return cors(
    json({
      authenticated: true,
      user: {
        login: user.login,
        name: user.name || user.login,
        avatar_url: user.avatar_url,
      },
      scope: session.scope,
    }),
    request,
    env,
  );
}

async function handleLogout(request, env) {
  const headers = new Headers();
  headers.append(
    "Set-Cookie",
    `${SESSION_COOKIE}=; Path=/; Secure; SameSite=Lax; Max-Age=0; HttpOnly`,
  );
  headers.append(
    "Set-Cookie",
    `${STATE_COOKIE}=; Path=/; Secure; SameSite=Lax; Max-Age=0; HttpOnly`,
  );
  return cors(json({ ok: true }, 200, headers), request, env);
}

/* ---------------------------------------------------------------- */
/* GitHub API proxy                                                  */
/* ---------------------------------------------------------------- */

async function handleProxy(request, env, path) {
  const url = new URL(request.url);
  const session = await readSession(request, env);
  if (!session) {
    return cors(json({ error: "Not authenticated" }, 401), request, env);
  }

  // /api/gh/repos/...  ->  /repos/...
  const ghPath = path.replace(/^\/api\/gh/, "");

  // Least privilege: only allow requests to this repo's contents (the Studio
  // only reads/writes src/content and public/images in the blog repository).
  const repo = (env.DEFAULT_REPO || "The-Technology-Joint-Blog").toLowerCase();
  const owner = (env.DEFAULT_OWNER || "godlyaitm").toLowerCase();
  if (!ghPath.toLowerCase().startsWith(`/repos/${owner}/${repo}/`)) {
    return cors(json({ error: "Forbidden" }, 403), request, env);
  }

  const ghUrl = new URL(`${GH_API}${ghPath}`);
  url.searchParams.forEach((value, key) => ghUrl.searchParams.set(key, value));

  const headers = new Headers({
    Accept: "application/vnd.github+json",
    Authorization: `Bearer ${session.token}`,
    "X-GitHub-Api-Version": "2022-11-28",
  });
  if (request.headers.get("Content-Type")) {
    headers.set("Content-Type", request.headers.get("Content-Type"));
  }

  const upstream = await fetch(ghUrl.toString(), {
    method: request.method,
    headers,
    body: ["GET", "HEAD"].includes(request.method) ? undefined : await request.text(),
  });

  const body = await upstream.text();
  const response = new Response(body, {
    status: upstream.status,
    headers: { "Content-Type": upstream.headers.get("Content-Type") || "application/json" },
  });
  return cors(response, request, env);
}

/* ---------------------------------------------------------------- */
/* Session cookie encryption (AES-GCM via WebCrypto)                 */
/* ---------------------------------------------------------------- */

async function deriveKey(env) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(env.COOKIE_SECRET));
  return crypto.subtle.importKey("raw", digest, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
}

async function encryptSession(env, session) {
  const key = await deriveKey(env);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const data = new TextEncoder().encode(JSON.stringify(session));
  const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, data);
  return `${btoaUrl(iv)}.${btoaUrl(new Uint8Array(ciphertext))}`;
}

async function decryptSession(env, value) {
  const [ivB64, dataB64] = value.split(".");
  if (!ivB64 || !dataB64) return null;
  try {
    const key = await deriveKey(env);
    const iv = atobUrl(ivB64);
    const ciphertext = atobUrl(dataB64);
    const plaintext = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ciphertext);
    return JSON.parse(new TextDecoder().decode(plaintext));
  } catch {
    return null;
  }
}

async function readSession(request, env) {
  const raw = readCookie(request.headers.get("Cookie"), SESSION_COOKIE);
  if (!raw) return null;
  const session = await decryptSession(env, raw);
  if (!session || !session.token || session.exp < Math.floor(Date.now() / 1000)) return null;
  return session;
}

/* ---------------------------------------------------------------- */
/* Helpers                                                           */
/* ---------------------------------------------------------------- */

function callbackUrl(origin) {
  return `${origin}/api/auth/callback`;
}

function defaultStudioUrl(env) {
  const base = (env.SITE_BASE || "").replace(/\/$/, "");
  return `${env.SITE_ORIGIN || "https://godlyaitm.github.io"}${base}/studio`;
}

/**
 * Only allow `next` targets on the static site itself, preventing open
 * redirects after OAuth. Accepts the exact origin (optionally with the
 * site base path).
 */
function safeNext(env, value) {
  if (!value) return null;
  const origin = env.SITE_ORIGIN || "https://godlyaitm.github.io";
  const base = (env.SITE_BASE || "").replace(/\/$/, "");
  const allowed = `${origin}${base}`;
  if (value === origin || value === allowed || value.startsWith(allowed + "/")) {
    return value;
  }
  return null;
}

function randomHex(bytes) {
  const arr = crypto.getRandomValues(new Uint8Array(bytes));
  return [...arr].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function readCookie(cookieHeader, name) {
  if (!cookieHeader) return null;
  for (const part of cookieHeader.split(";")) {
    const [key, ...rest] = part.trim().split("=");
    if (key === name) return rest.join("=");
  }
  return null;
}

function json(data, status, extraHeaders) {
  const headers = new Headers({ "Content-Type": "application/json; charset=utf-8" });
  if (extraHeaders) extraHeaders.forEach((value, key) => headers.set(key, value));
  return new Response(JSON.stringify(data), { status, headers });
}

function preflight() {
  return new Response(null, { status: 204 });
}

function cors(response, request, env) {
  const headers = new Headers(response.headers);
  // Echo the requesting origin only when it's on the allowed list. With
  // credentials, ACAO can never be "*". Requests without an Origin header
  // (curl, server-to-server) get no ACAO at all.
  const origin = request.headers.get("Origin");
  const allowedOrigins = ((env && env.SITE_ORIGIN) || "https://godlyaitm.github.io")
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean);
  if (origin && allowedOrigins.includes(origin)) {
    headers.set("Access-Control-Allow-Origin", origin);
    headers.set("Access-Control-Allow-Credentials", "true");
  }
  headers.set(
    "Access-Control-Allow-Methods",
    "GET, POST, PUT, DELETE, OPTIONS",
  );
  headers.set(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization, X-GitHub-Api-Version",
  );
  headers.set("Vary", "Origin");
  return new Response(response.body, { status: response.status, headers });
}

/* URL-safe base64 (for cookie values) */

function btoaUrl(bytes) {
  let bin = "";
  for (const byte of bytes) bin += String.fromCharCode(byte);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function atobUrl(str) {
  const b64 = str.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (str.length % 4)) % 4);
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}
