/**
 * GET /api/auth/session
 * Returns { authenticated: true, user: { username } } when the request
 * carries a valid session cookie, otherwise { authenticated: false }.
 */
import { json, handleCors, getSessionUser } from "../_lib.js";

export const config = { runtime: "nodejs" };

export default async function handler(req, res) {
    if (!handleCors(req, res)) return json(res, 403, { error: "Origin not allowed" });
    if (req.method === "OPTIONS") return res.status(204).end();
    if (req.method !== "GET") return json(res, 405, { error: "Method not allowed" });

    const session = await getSessionUser(req);
    if (!session) return json(res, 200, { authenticated: false });

    return json(res, 200, {
        authenticated: true,
        user: { username: session.username },
    });
}
