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
    RATE_KEY,
    createUser,
    isOwner,
    getSessionUser,
    rateLimit,
    clientIp,
} from "../_lib.js";

export const config = { runtime: "nodejs" };

export default async function handler(req, res) {
    if (!handleCors(req, res)) return json(res, 403, { error: "Origin not allowed" });
    if (req.method === "OPTIONS") return res.status(204).end();
    if (req.method !== "POST") return json(res, 405, { error: "Method not allowed" });

    try {
        // Public registration is no longer allowed. Only the owner can
        // create accounts through the owner panel (this endpoint is
        // repurposed for owner-only user creation).
        const session = await getSessionUser(req);
        if (!session) {
            return json(res, 403, { error: "Authentication required to create accounts." });
        }
        if (!(await isOwner(session.username))) {
            return json(res, 403, { error: "Only the owner can create new accounts." });
        }

        // Rate limit owner registrations too (prevent abuse).
        const ipLimit = await rateLimit(RATE_KEY("register", clientIp(req)), 30, 60 * 60);
        if (!ipLimit.allowed) {
            return json(res, 429, {
                error: "Too many registration attempts — try again in an hour.",
            });
        }

        const body = await readBody(req);
        const username = String(body.username || "").trim().toLowerCase();
        const password = String(body.password || "");

        if (!username || !password) {
            return json(res, 400, { error: "Username and password are required." });
        }

        const result = await createUser(username, password);
        if (!result.ok) {
            return json(res, 400, { error: result.error });
        }

        // Don't auto-login — the owner stays logged in as themselves.
        return json(res, 200, { ok: true, user: { username, role: result.role } });
    } catch (err) {
        const message = err instanceof Error ? err.message : "Internal error";
        if (/Missing environment variable|not configured/.test(message)) {
            return json(res, 500, { error: message });
        }
        return json(res, 500, { error: "Internal error" });
    }
}
