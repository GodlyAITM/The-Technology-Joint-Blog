/**
 * POST /api/auth/register
 * Creates a username/password account (requires the invite code) and signs
 * the new editor in immediately with a session cookie — registering grants
 * automatic access to the shared GitHub token.
 */
import {
    json,
    handleCors,
    readBody,
    redis,
    USER_KEY,
    RATE_KEY,
    hashPassword,
    safeEqual,
    setSessionCookie,
    requiredEnv,
    rateLimit,
    clientIp,
} from "../_lib.js";

export const config = { runtime: "nodejs" };

export default async function handler(req, res) {
    if (!handleCors(req, res)) return json(res, 403, { error: "Origin not allowed" });
    if (req.method === "OPTIONS") return res.status(204).end();
    if (req.method !== "POST") return json(res, 405, { error: "Method not allowed" });

    try {
        // Guard against bulk signups even with the invite code.
        const ipLimit = await rateLimit(RATE_KEY("register", clientIp(req)), 10, 60 * 60);
        if (!ipLimit.allowed) {
            return json(res, 429, {
                error: "Too many registration attempts from this address — try again in an hour.",
            });
        }

        const inviteCode = requiredEnv("INVITE_CODE");
        const body = await readBody(req);
        const username = String(body.username || "").trim().toLowerCase();
        const password = String(body.password || "");
        const providedInvite = String(body.inviteCode || "").trim();

        if (!safeEqual(providedInvite, inviteCode)) {
            return json(res, 403, { error: "Invalid invite code." });
        }
        if (!/^[a-z0-9._-]{3,32}$/.test(username)) {
            return json(res, 400, {
                error: "Username must be 3–32 characters using letters, numbers, dots, dashes or underscores.",
            });
        }
        if (password.length < 8 || password.length > 128) {
            return json(res, 400, {
                error: "Password must be between 8 and 128 characters.",
            });
        }

        const r = redis();
        const key = USER_KEY(username);
        const existing = await r.get(key);
        if (existing) {
            return json(res, 409, { error: "That username is already taken." });
        }

        const { salt, hash } = hashPassword(password);
        await r.set(
            key,
            JSON.stringify({ username, salt, hash, createdAt: Date.now() }),
            { ex: 60 * 60 * 24 * 365 * 5 }, // 5 years — effectively permanent
        );

        // Registering signs the user in automatically.
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
