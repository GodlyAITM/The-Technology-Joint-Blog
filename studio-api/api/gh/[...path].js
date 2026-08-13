/**
 * /api/gh/* — GitHub API proxy.
 *
 * Requires a valid team session cookie, then forwards the request to
 * api.github.com authenticated with the SHARED_PAT env secret, so the
 * token never reaches the browser. Least privilege: only paths under
 * /repos/{owner}/{repo}/ are allowed (the blog repository).
 */
import {
    json,
    handleCors,
    getSessionUser,
    requiredEnv,
    repoDefaults,
    readBody,
} from "../_lib.js";

export const config = { runtime: "nodejs" };

const GH_API = "https://api.github.com";

export default async function handler(req, res) {
    if (!handleCors(req, res)) return json(res, 403, { error: "Origin not allowed" });
    if (req.method === "OPTIONS") return res.status(204).end();

    try {
        const session = await getSessionUser(req);
        if (!session) {
            return json(res, 401, { error: "Not authenticated" });
        }

        const { owner, repo } = repoDefaults();
        const parts = req.query.path;
        const raw = Array.isArray(parts) ? parts.join("/") : String(parts || "");
        const ghPath = "/" + raw.replace(/^\/+/, "");

        // Only the blog repo's contents API is reachable.
        if (!ghPath.toLowerCase().startsWith(`/repos/${owner}/${repo}/`)) {
            return json(res, 403, { error: "Forbidden" });
        }

        const token = requiredEnv("SHARED_PAT");
        const query = new URL(req.url, "http://localhost").search;

        const headers = {
            Accept: "application/vnd.github+json",
            Authorization: `Bearer ${token}`,
            "X-GitHub-Api-Version": "2022-11-28",
        };
        const contentType = req.headers["content-type"];
        if (contentType) headers["Content-Type"] = contentType;

        const body = ["GET", "HEAD"].includes(req.method)
            ? undefined
            : JSON.stringify(await readBody(req));

        const upstream = await fetch(`${GH_API}${ghPath}${query}`, {
            method: req.method,
            headers,
            body,
        });

        const text = await upstream.text();
        res.status(upstream.status);
        res.setHeader(
            "Content-Type",
            upstream.headers.get("content-type") || "application/json",
        );
        res.send(text);
    } catch (err) {
        const message = err instanceof Error ? err.message : "Internal error";
        if (/Missing environment variable|not configured/.test(message)) {
            return json(res, 500, { error: message });
        }
        return json(res, 500, { error: "Internal error" });
    }
}
