/**
 * Shared helpers for the Technology Joint Studio team-login API
 * (Vercel Node functions, project root directory: studio-api/).
 *
 * Security model (mirrors the Cloudflare worker's design):
 *  - The shared GitHub PAT lives ONLY in the SHARED_PAT env secret and
 *    never ships to the browser.
 *  - User accounts (username + salted scrypt hash) live in Upstash Redis
 *    (Vercel KV) — the free tier is plenty for a small editorial team.
 *  - Sessions are stateless AES-256-GCM encrypted HttpOnly cookies. The
 *    cookie is cross-site (static site on github.io, API on vercel.app),
 *    so it must be Secure + SameSite=None.
 *
 * Env vars (set in the Vercel project):
 *   SHARED_PAT                 fine-grained GitHub token (Contents + Workflows R/W on the blog repo)
 *   COOKIE_SECRET              long random string used to encrypt session cookies
 *   INVITE_CODE                secret code required to register new accounts
 *   KV_REST_API_URL            from the Vercel KV (Upstash) store
 *   KV_REST_API_TOKEN          from the Vercel KV (Upstash) store
 *   SITE_ORIGIN                comma-separated allowed origins (CORS + Origin rejection)
 *
 * Sessions persist for 7 days (Max-Age) so editors don't re-login on every
 * visit; the PAT mode's sessionStorage flag remains session-only.
 *   SITE_BASE, DEFAULT_OWNER, DEFAULT_REPO, DEFAULT_BRANCH
 */

import {
    createCipheriv,
    createDecipheriv,
    createHash,
    randomBytes,
    scryptSync,
    timingSafeEqual,
} from "node:crypto";
import { Redis } from "@upstash/redis";

export const SESSION_COOKIE = "ttj_team_session";
export const SESSION_TTL_SECONDS = 7 * 24 * 60 * 60; // 7 days

/* ---------------------------------------------------------------- */
/* Env / config                                                      */
/* ---------------------------------------------------------------- */

export function requiredEnv(name) {
    const value = process.env[name];
    if (!value) throw new Error(`Missing environment variable: ${name}`);
    return value;
}

export function allowedOrigins() {
    return (
        process.env.SITE_ORIGIN ||
        "https://godlyaitm.github.io,http://localhost:4321,http://127.0.0.1:4321"
    )
        .split(",")
        .map((o) => o.trim().replace(/\/$/, ""))
        .filter(Boolean);
}

export function repoDefaults() {
    return {
        owner: (process.env.DEFAULT_OWNER || "godlyaitm").toLowerCase(),
        repo: (process.env.DEFAULT_REPO || "The-Technology-Joint-Blog").toLowerCase(),
        branch: process.env.DEFAULT_BRANCH || "main",
    };
}

/* ---------------------------------------------------------------- */
/* Redis (Upstash / Vercel KV)                                       */
/* ---------------------------------------------------------------- */

export function redis() {
    const url = process.env.KV_REST_API_URL;
    const token = process.env.KV_REST_API_TOKEN;
    if (!url || !token) {
        throw new Error(
            "KV_REST_API_URL and KV_REST_API_TOKEN are not configured (add a Vercel KV store).",
        );
    }
    return new Redis({ url, token });
}

export const USER_KEY = (username) => `ttj:user:${username}`;
export const RATE_KEY = (kind, id) => `ttj:rl:${kind}:${id}`;

/* ---------------------------------------------------------------- */
/* Password hashing (scrypt, per-user salt)                           */
/* ---------------------------------------------------------------- */

export function hashPassword(password) {
    const salt = randomBytes(16).toString("hex");
    const hash = scryptSync(password, salt, 64).toString("hex");
    return { salt, hash };
}

export function verifyPassword(password, salt, expectedHex) {
    try {
        const expected = Buffer.from(expectedHex, "hex");
        const actual = scryptSync(password, salt, expected.length || 64);
        return (
            actual.length === expected.length &&
            timingSafeEqual(actual, expected)
        );
    } catch {
        return false;
    }
}

/** Constant-time string comparison (for the invite code). */
export function safeEqual(a, b) {
    const ba = Buffer.from(String(a ?? ""));
    const bb = Buffer.from(String(b ?? ""));
    if (ba.length !== bb.length) return false;
    return timingSafeEqual(ba, bb);
}

/* ---------------------------------------------------------------- */
/* Sessions — stateless AES-256-GCM encrypted cookie                  */
/* ---------------------------------------------------------------- */

function sessionKey() {
    return createHash("sha256").update(requiredEnv("COOKIE_SECRET")).digest();
}

export function encryptSession(payload) {
    const key = sessionKey();
    const iv = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", key, iv);
    const encrypted = Buffer.concat([
        cipher.update(JSON.stringify(payload), "utf8"),
        cipher.final(),
    ]);
    const tag = cipher.getAuthTag();
    return Buffer.concat([iv, tag, encrypted]).toString("base64url");
}

export function decryptSession(value) {
    try {
        const buf = Buffer.from(value, "base64url");
        if (buf.length < 28) return null;
        const iv = buf.subarray(0, 12);
        const tag = buf.subarray(12, 28);
        const data = buf.subarray(28);
        const decipher = createDecipheriv("aes-256-gcm", sessionKey(), iv);
        decipher.setAuthTag(tag);
        const plain = Buffer.concat([
            decipher.update(data),
            decipher.final(),
        ]).toString("utf8");
        const payload = JSON.parse(plain);
        if (
            !payload ||
            typeof payload.username !== "string" ||
            !payload.exp ||
            payload.exp < Math.floor(Date.now() / 1000)
        ) {
            return null;
        }
        return payload;
    } catch {
        return null;
    }
}

export function readCookie(req, name) {
    const header = req.headers.cookie || "";
    for (const part of header.split(";")) {
        const idx = part.indexOf("=");
        if (idx === -1) continue;
        if (part.slice(0, idx).trim() === name) {
            return part.slice(idx + 1).trim();
        }
    }
    return null;
}

export async function getSessionUser(req) {
    const raw = readCookie(req, SESSION_COOKIE);
    if (!raw) return null;
    return decryptSession(raw);
}

export function setSessionCookie(res, username) {
    const value = encryptSession({
        username,
        exp: Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS,
    });
    res.setHeader(
        "Set-Cookie",
        `${SESSION_COOKIE}=${value}; Path=/; Secure; SameSite=None; HttpOnly; Max-Age=${SESSION_TTL_SECONDS}`,
    );
}

export function clearSessionCookie(res) {
    res.setHeader(
        "Set-Cookie",
        `${SESSION_COOKIE}=; Path=/; Secure; SameSite=None; HttpOnly; Max-Age=0`,
    );
}

/* ---------------------------------------------------------------- */
/* HTTP helpers                                                      */
/* ---------------------------------------------------------------- */

/**
 * Apply CORS headers for an allowed origin. Returns false when the request
 * carries an Origin header that is not on the allowlist — callers should
 * reject with 403. Because the session cookie is SameSite=None (the API
 * lives on a different origin than the static site), rejecting unknown
 * origins outright is the main defense against cross-site request
 * forgery: browsers always send Origin on cross-origin requests.
 */
export function handleCors(req, res) {
    const origin = req.headers.origin;
    if (origin) {
        if (!allowedOrigins().includes(origin)) return false;
        res.setHeader("Access-Control-Allow-Origin", origin);
        res.setHeader("Access-Control-Allow-Credentials", "true");
    }
    res.setHeader(
        "Access-Control-Allow-Methods",
        "GET, POST, PUT, DELETE, OPTIONS",
    );
    res.setHeader(
        "Access-Control-Allow-Headers",
        "Content-Type, Authorization, X-GitHub-Api-Version",
    );
    res.setHeader("Vary", "Origin");
    return true;
}

export function json(res, status, data) {
    res.status(status);
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.json(data);
}

/** Best-effort request body: Vercel pre-parses JSON, fall back to raw. */
export async function readBody(req) {
    if (req.body && typeof req.body === "object") return req.body;
    let raw = "";
    for await (const chunk of req) raw += chunk;
    try {
        return raw ? JSON.parse(raw) : {};
    } catch {
        return {};
    }
}

export function clientIp(req) {
    return String(
        req.headers["x-forwarded-for"] ||
            req.socket?.remoteAddress ||
            "unknown",
    )
        .split(",")[0]
        .trim();
}

/* ---------------------------------------------------------------- */
/* Rate limiting (Redis INCR with expiry)                             */
/* ---------------------------------------------------------------- */

export async function rateLimit(key, limit, windowSeconds) {
    const r = redis();
    const count = await r.incr(key);
    if (count === 1) {
        await r.expire(key, windowSeconds);
    }
    return { allowed: count <= limit, remaining: Math.max(0, limit - count) };
}
