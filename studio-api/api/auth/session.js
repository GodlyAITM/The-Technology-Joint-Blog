/**
 * GET /api/auth/session
 * Returns { authenticated: true, user: { username } } when the request
 * carries a valid session cookie, otherwise { authenticated: false }.
 */
import { json, handleCors, getSessionUser, getUser, hasOwner } from "../_lib.js";

export const config = { runtime: "nodejs" };

export default async function handler(req, res) {
    if (!handleCors(req, res)) return json(res, 403, { error: "Origin not allowed" });
    if (req.method === "OPTIONS") return res.status(204).end();
    if (req.method !== "GET") return json(res, 405, { error: "Method not allowed" });

    const session = await getSessionUser(req);
    if (!session) return json(res, 200, { authenticated: false });

    // Include role in the session response so the frontend knows if the
    // user is the owner (for showing the user management panel).
    let role = "member";
    try {
        const user = await getUser(session.username);
        if (user?.role) role = user.role;
    } catch {
        // role defaults to member on KV failure
    }

    return json(res, 200, {
        authenticated: true,
        user: { username: session.username, role },
        ownerExists: await hasOwner(),
    });
}
