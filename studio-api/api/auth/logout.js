/**
 * POST /api/auth/logout
 * Clears the session cookie.
 */
import { json, handleCors, clearSessionCookie } from "../_lib.js";

export const config = { runtime: "nodejs" };

export default async function handler(req, res) {
    if (!handleCors(req, res)) return json(res, 403, { error: "Origin not allowed" });
    if (req.method === "OPTIONS") return res.status(204).end();
    if (req.method !== "POST") return json(res, 405, { error: "Method not allowed" });

    clearSessionCookie(res);
    return json(res, 200, { ok: true });
}
