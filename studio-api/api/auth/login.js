/**
 * POST /api/auth/login
 * Verifies a username/password against the KV user store (with brute-force
 * rate limiting) and issues a session cookie. On success the shared GitHub
 * token is unlocked for /api/gh/* proxying.
 */
import {
    json,
    handleCors,
    readBody,
    redis,
    USER_KEY,
    RATE_KEY,
    verifyPassword,
    setSessionCookie,
    rateLimit,
    clientIp,
} from "../_lib.js";

export const config = { runtime: "nodejs" };

export default async function handler(req, res) {
    if (!handleCors(req, res)) return json(res, 403, { error: "Origin not allowed" });
    if (req.method === "OPTIONS") return res.status(204).end();
    if (req.method !== "POST") return json(res, 405, { error: "Method not allowed" });

    try {
        const body = await readBody(req);
        const username = String(body.username || "").trim().toLowerCase();
        const password = String(body.password || "");

        if (!username || !password) {
            return json(res, 400, { error: "Username and password are required." });
        }

        const ip = clientIp(req);

        // Brute-force guard: per IP and per account+IP, both sliding.
        const ipLimit = await rateLimit(RATE_KEY("login-ip", ip), 30, 15 * 60);
        if (!ipLimit.allowed) {
            return json(res, 429, {
                error: "Too many attempts — try again in 15 minutes.",
            });
        }
        const userLimit = await rateLimit(
            RATE_KEY(`login-user:${username}`, ip),
            8,
            15 * 60,
        );
        if (!userLimit.allowed) {
            return json(res, 429, {
                error: "Too many attempts for this account — try again in 15 minutes.",
            });
        }

        // Generic failure message on purpose — do not reveal whether the
        // username exists.
        let valid = false;
        try {
            const r = redis();
            const raw = await r.get(USER_KEY(username));
            if (raw) {
                const record = JSON.parse(raw);
                valid = verifyPassword(password, record.salt, record.hash);
            }
        } catch (err) {
            if (err instanceof Error && /Missing environment variable|not configured/.test(err.message)) {
                throw err;
            }
            // KV outage — surface a 503 instead of masquerading as bad
            // credentials.
            return json(res, 503, {
                error: "Sign-in is temporarily unavailable — try again shortly.",
            });
        }

        if (!valid) {
            return json(res, 401, { error: "Invalid username or password." });
        }

        setSessionCookie(res, username);
        return json(res, 200, { ok: true, user: { username } });
    } catch (err) {
        const message = err instanceof Error ? err.message : "Internal error";
        if (/Missing environment variable|not configured/.test(message)) {
            return json(res, 500, { error: message });
        }
        return json(res, 500, { error: "Internal error" });
    }
}
