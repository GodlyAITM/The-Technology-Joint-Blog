/**
 * TEMPORARY diagnostic stub — simulates the Studio API Cloudflare worker
 * locally so the real editor loading chain can be exercised in a browser.
 * GET /api/gh/* is proxied to the REAL public GitHub repo (read-only works
 * without a token for public repos). Every request is logged.
 */
import { createServer } from "node:http";

const PORT = 8787;
const ALLOWED_ORIGINS = ["http://localhost:4321", "http://127.0.0.1:4321"];

const GH_API = "https://api.github.com";

const log = (...args) => console.log(`[stub-worker ${new Date().toISOString()}]`, ...args);

const server = createServer(async (req, res) => {
    const url = new URL(req.url, `http://localhost:${PORT}`);
    const origin = req.headers.origin || "";

    const isAllowed = ALLOWED_ORIGINS.includes(origin);
    const corsHeaders = {
        ...(isAllowed
            ? { "Access-Control-Allow-Origin": origin, "Access-Control-Allow-Credentials": "true" }
            : {}),
        "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization, X-GitHub-Api-Version",
        Vary: "Origin",
    };

    const send = (status, data, extra = {}) => {
        res.writeHead(status, { "Content-Type": "application/json; charset=utf-8", ...corsHeaders, ...extra });
        res.end(typeof data === "string" ? data : JSON.stringify(data));
    };

    if (req.method === "OPTIONS") {
        res.writeHead(204, corsHeaders);
        res.end();
        return;
    }

    log(`${req.method} ${url.pathname}${url.search} (origin=${origin || "none"})`);

    if (url.pathname === "/api/auth/session") {
        log("→ returning authenticated session");
        send(200, { authenticated: true, user: { login: "diag-test", name: "Diag Test", avatar_url: "" }, scope: "repo" });
        return;
    }

    if (url.pathname.startsWith("/api/gh/")) {
        const ghPath = url.pathname.replace(/^\/api\/gh/, "");
        const ghUrl = new URL(`${GH_API}${ghPath}`);
        url.searchParams.forEach((v, k) => ghUrl.searchParams.set(k, v));
        log(`→ proxying to ${ghUrl.toString()}`);
        try {
            const upstream = await fetch(ghUrl.toString(), {
                method: req.method,
                headers: { Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28" },
                body: ["GET", "HEAD"].includes(req.method) ? undefined : await new Promise((r) => {
                    let d = "";
                    req.on("data", (c) => (d += c));
                    req.on("end", () => r(d));
                }),
            });
            const body = await upstream.text();
            log(`← GitHub ${upstream.status} ${body.length} bytes`);
            send(upstream.status, body);
        } catch (err) {
            log(`← proxy error: ${err.message}`);
            send(500, { error: err.message });
        }
        return;
    }

    send(404, { error: "Not found" });
});

server.listen(PORT, () => log(`listening on http://localhost:${PORT}`));
