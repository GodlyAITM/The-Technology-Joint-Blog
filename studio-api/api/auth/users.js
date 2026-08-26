/**
 * /api/auth/users — Owner-only user management.
 *
 * GET    /api/auth/users         → list all users
 * POST   /api/auth/users         → create a new user (owner only)
 * DELETE /api/auth/users?username=X → remove/deactivate a user (owner only)
 *
 * Requires a valid session cookie; only the owner can access this endpoint.
 */
import {
    json,
    handleCors,
    readBody,
    getSessionUser,
    isOwner,
    listUsers,
    createUser,
    removeUser,
    rateLimit,
    RATE_KEY,
    clientIp,
} from "../_lib.js";

export const config = { runtime: "nodejs" };

export default async function handler(req, res) {
    if (!handleCors(req, res)) return json(res, 403, { error: "Origin not allowed" });
    if (req.method === "OPTIONS") return res.status(204).end();

    try {
        const session = await getSessionUser(req);
        if (!session) {
            return json(res, 401, { error: "Not authenticated" });
        }
        if (!(await isOwner(session.username))) {
            return json(res, 403, { error: "Only the owner can manage users." });
        }

        if (req.method === "GET") {
            const users = await listUsers();
            return json(res, 200, { users });
        }

        if (req.method === "POST") {
            const ipLimit = await rateLimit(RATE_KEY("users-create", clientIp(req)), 30, 60 * 60);
            if (!ipLimit.allowed) {
                return json(res, 429, {
                    error: "Too many user creation attempts — try again in an hour.",
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

            return json(res, 200, { ok: true, user: { username, role: result.role } });
        }

        if (req.method === "DELETE") {
            const url = new URL(req.url, "http://localhost");
            const username = String(url.searchParams.get("username") || "").trim().toLowerCase();

            if (!username) {
                return json(res, 400, { error: "Username is required." });
            }

            const result = await removeUser(username);
            if (!result.ok) {
                return json(res, 400, { error: result.error });
            }

            return json(res, 200, { ok: true });
        }

        return json(res, 405, { error: "Method not allowed" });
    } catch (err) {
        const message = err instanceof Error ? err.message : "Internal error";
        if (/Missing environment variable|not configured/.test(message)) {
            return json(res, 500, { error: message });
        }
        return json(res, 500, { error: "Internal error" });
    }
}
