/**
 * Client-side GitHub API helpers for the Studio workspace.
 *
 * Transport modes:
 *
 *  1. PAT mode (default): the GitHub Contents API is called directly from
 *     the browser using a personal access token stored in sessionStorage
 *     (set in Studio → Settings). No server required.
 *
 *  2. Team mode (default when `PUBLIC_STUDIO_API_URL` is set): GitHub
 *     calls are proxied through the team-login API (/api/gh/*). The API
 *     holds ONE shared GitHub token server-side; editors get access by
 *     registering a username/password (with an invite code). No GitHub
 *     accounts or tokens needed per person.
 *
 *  3. OAuth mode (optional): same proxy as team mode but authenticates
 *     through GitHub OAuth instead of username/password accounts. Set
 *     `PUBLIC_STUDIO_AUTH_MODE` to "oauth" to enable.
 */

export interface StudioConfig {
    owner: string;
    repo: string;
    branch: string;
    token?: string;
    /** Simple Analytics hostname used for the traffic stats panel. */
    analyticsDomain?: string;
}

export interface ArticleData {
    title: string;
    description: string;
    pubDate: string;
    updatedDate?: string;
    author: string;
    category: string;
    tags: string[];
    featured: boolean;
    draft: boolean;
    /** Archived articles are hidden from the public site (kept in the Studio). */
    archived?: boolean;
    heroImage?: string;
    featuredImageAlt?: string;
    seoTitle?: string;
    seoDescription?: string;
    canonicalURL?: string;
}

// Stored in sessionStorage (not localStorage) so the token is never
// remembered across browser sessions — consistent with the studio's
// "always require login" policy.
const STORAGE_KEY = "studio-github-config";
const API = "https://api.github.com";

export type StudioAuthMode = "pat" | "team" | "oauth";

/**
 * Which authentication flow the Studio uses:
 *  - "pat"   — per-device personal access token (no API configured)
 *  - "team"  — shared-token username/password accounts (default when an
 *              API URL is configured; set PUBLIC_STUDIO_AUTH_MODE=team)
 *  - "oauth" — GitHub OAuth via the optional Cloudflare worker
 *
 * Build-safe: unset env vars fall back to the defaults below, so the
 * missing variable can never break the build.
 */
export function getAuthMode(): StudioAuthMode {
    if (!getApiBase()) return "pat";
    const mode = (
        import.meta.env.PUBLIC_STUDIO_AUTH_MODE as string | undefined
    )
        ?.trim()
        .toLowerCase();
    return mode === "oauth" ? "oauth" : "team";
}

export const DEFAULT_OWNER = "godlyaitm";
export const DEFAULT_REPO = "The-Technology-Joint-Blog";
export const DEFAULT_BRANCH = "main";

/* ------------------------------------------------------------------ */
/* Transport config                                                    */
/* ------------------------------------------------------------------ */

/** Base URL of the Studio OAuth worker (e.g. https://ttj-studio-api.workers.dev). */
export function getApiBase(): string {
    const raw = import.meta.env.PUBLIC_STUDIO_API_URL as string | undefined;
    return (raw || "").replace(/\/$/, "");
}

/** True when the OAuth worker is configured (production OAuth mode). */
export function hasApi(): boolean {
    return Boolean(getApiBase());
}

export function getStudioConfig(): StudioConfig | null {
    try {
        const raw = window.sessionStorage.getItem(STORAGE_KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw) as Partial<StudioConfig>;
        if (!parsed.owner || !parsed.repo) return null;
        return {
            owner: parsed.owner,
            repo: parsed.repo,
            branch: parsed.branch || DEFAULT_BRANCH,
            token: parsed.token,
            analyticsDomain: parsed.analyticsDomain,
        };
    } catch {
        return null;
    }
}

export function saveStudioConfig(config: StudioConfig): void {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(config));
}

export function hasStudioConfig(): boolean {
    return getStudioConfig() !== null;
}

/* ------------------------------------------------------------------ */
/* Session (OAuth mode)                                                */
/* ------------------------------------------------------------------ */

export interface StudioSession {
    authenticated: boolean;
    user?: { login: string; name?: string; avatar_url?: string } | null;
    scope?: string;
}

/** Ask the API whether the current browser has a valid session. */
export async function getSession(): Promise<StudioSession | null> {
    const apiBase = getApiBase();
    if (!apiBase) return null;
    try {
        const response = await fetch(`${apiBase}/api/auth/session`, {
            credentials: "include",
            headers: { Accept: "application/json" },
        });
        if (!response.ok) return { authenticated: false };
        const data = (await response.json()) as {
            authenticated?: boolean;
            user?: {
                login?: string;
                username?: string;
                name?: string;
                avatar_url?: string;
            } | null;
            scope?: string;
        };
        // Normalize: team mode returns { username }, OAuth mode returns
        // { login }. Callers read `user.login` either way.
        return {
            authenticated: Boolean(data.authenticated),
            user: data.user
                ? {
                      login: data.user.login ?? data.user.username ?? "",
                      name: data.user.name,
                      avatar_url: data.user.avatar_url,
                  }
                : null,
            scope: data.scope,
        };
    } catch {
        return { authenticated: false };
    }
}

/** Sign out of the worker session. */
export async function signOut(): Promise<void> {
    const apiBase = getApiBase();
    if (!apiBase) return;
    try {
        await fetch(`${apiBase}/api/auth/logout`, {
            method: "POST",
            credentials: "include",
        });
    } catch {
        // best-effort — local redirect still happens
    }
}

/**
 * URL to send an unauthenticated visitor to for sign-in.
 *  - OAuth mode: GitHub authorization flow on the API.
 *  - Team mode: the Studio login page (username/password + registration).
 */
export function getLoginUrl(next?: string): string {
    const apiBase = getApiBase();
    if (!apiBase) return "/studio/login";
    const params = new URLSearchParams();
    if (next) params.set("next", next);
    if (getAuthMode() === "oauth") {
        return `${apiBase}/api/auth/login${params.size ? `?${params.toString()}` : ""}`;
    }
    const base = import.meta.env.BASE_URL.replace(/\/$/, "");
    return `${base}/studio/login${params.size ? `?${params.toString()}` : ""}`;
}

/* ------------------------------------------------------------------ */
/* Team-mode authentication (username/password + invite code)          */
/* ------------------------------------------------------------------ */

export interface TeamAuthResult {
    ok: boolean;
    error?: string;
}

async function teamAuth(
    path: "/api/auth/login" | "/api/auth/register",
    payload: Record<string, string>,
): Promise<TeamAuthResult> {
    const apiBase = getApiBase();
    if (!apiBase) return { ok: false, error: "The Studio API is not configured." };
    try {
        const response = await fetch(`${apiBase}${path}`, {
            method: "POST",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
        });
        const data = (await response.json().catch(() => ({}))) as {
            error?: string;
        };
        if (!response.ok) {
            return {
                ok: false,
                error:
                    data.error ||
                    `${path === "/api/auth/login" ? "Sign in" : "Registration"} failed (${response.status}).`,
            };
        }
        return { ok: true };
    } catch {
        return { ok: false, error: "Could not reach the Studio API." };
    }
}

/** Sign in with a Studio account (username/password). */
export function teamLogin(
    username: string,
    password: string,
): Promise<TeamAuthResult> {
    return teamAuth("/api/auth/login", { username, password });
}

/** Create a Studio account with the invite code — signs in automatically. */
export function teamRegister(
    username: string,
    password: string,
    inviteCode: string,
): Promise<TeamAuthResult> {
    return teamAuth("/api/auth/register", { username, password, inviteCode });
}

/* ------------------------------------------------------------------ */
/* Low-level API call                                                  */
/* ------------------------------------------------------------------ */

interface GitHubContentResult {
    sha?: string;
    content?: string;
    message?: string;
}

class GitHubApiError extends Error {
    status: number;
    constructor(message: string, status: number) {
        super(message);
        this.status = status;
    }
}

async function api<T = GitHubContentResult>(
    path: string,
    init?: RequestInit,
    config?: StudioConfig,
): Promise<T> {
    const apiBase = getApiBase();

    if (apiBase) {
        // OAuth mode — proxy through the worker
        const response = await fetch(`${apiBase}/api/gh${path}`, {
            ...init,
            credentials: "include",
            headers: {
                Accept: "application/vnd.github+json",
                "X-GitHub-Api-Version": "2022-11-28",
                ...(init?.headers ?? {}),
            },
        });

        if (!response.ok) {
            let message = `GitHub API ${response.status} ${response.statusText}`;
            try {
                const body = (await response.json()) as { message?: string };
                if (body?.message) message = body.message;
            } catch {
                // keep the default message
            }
            throw new GitHubApiError(message, response.status);
        }

        return response.json() as Promise<T>;
    }

    // Legacy PAT mode — direct GitHub API
    const cfg = config ?? getStudioConfig();
    if (!cfg?.token) {
        throw new Error(
            "GitHub is not connected. Sign in with GitHub, or add a token in Studio → Settings.",
        );
    }

    const response = await fetch(`${API}${path}`, {
        ...init,
        headers: {
            Accept: "application/vnd.github+json",
            Authorization: `Bearer ${cfg.token}`,
            "X-GitHub-Api-Version": "2022-11-28",
            ...(init?.headers ?? {}),
        },
    });

    if (!response.ok) {
        let message = `GitHub API ${response.status} ${response.statusText}`;
        try {
            const body = (await response.json()) as { message?: string };
            if (body?.message) message = `GitHub API ${response.status}: ${body.message}`;
        } catch {
            // keep the default message
        }
        throw new Error(message);
    }

    return response.json() as Promise<T>;
}

/* ------------------------------------------------------------------ */
/* File operations                                                     */
/* ------------------------------------------------------------------ */

export interface StudioFile {
    sha: string;
    content?: string;
}

/**
 * Fetch a file's sha (+ decoded text content when it's a text file).
 * Returns null when the file does not exist.
 */
export async function getFile(
    path: string,
    options: { config?: StudioConfig; decode?: boolean } = {},
): Promise<StudioFile | null> {
    const cfg = options.config ?? getStudioConfig();
    if (!cfg && !hasApi()) return null;

    try {
        const data = await api<GitHubContentResult>(
            `/repos/${cfg?.owner ?? DEFAULT_OWNER}/${cfg?.repo ?? DEFAULT_REPO}/contents/${path}?ref=${encodeURIComponent(cfg?.branch ?? DEFAULT_BRANCH)}`,
            undefined,
            cfg ?? undefined,
        );
        if (!data.sha) return null;

        const decode = options.decode !== false;
        return {
            sha: data.sha,
            content:
                decode && data.content
                    ? base64ToString(data.content)
                    : undefined,
        };
    } catch (err) {
        // Structured 404 (OAuth mode) or legacy message prefix (PAT mode)
        if (err instanceof GitHubApiError && err.status === 404) return null;
        if (err instanceof Error && /^GitHub API 404/.test(err.message)) {
            return null;
        }
        throw err;
    }
}

/**
 * Create or update a file (text or base64-encoded binary) on the branch.
 * Pass `sha` to update an existing file.
 */
export async function putFile(
    path: string,
    content: string,
    message: string,
    options: { sha?: string; base64?: boolean; config?: StudioConfig } = {},
): Promise<GitHubContentResult> {
    const cfg = options.config ?? getStudioConfig();

    const body: Record<string, string> = {
        message,
        content: options.base64 ? content : stringToBase64(content),
        branch: cfg?.branch ?? DEFAULT_BRANCH,
    };
    if (options.sha) body.sha = options.sha;

    return api<GitHubContentResult>(
        `/repos/${cfg?.owner ?? DEFAULT_OWNER}/${cfg?.repo ?? DEFAULT_REPO}/contents/${path}`,
        { method: "PUT", body: JSON.stringify(body) },
        cfg ?? undefined,
    );
}

/** One entry returned by the GitHub Contents API for a directory. */
export interface StudioContentEntry {
    name: string;
    path: string;
    sha: string;
    size?: number;
    type: "file" | "dir" | "symlink" | "submodule";
    download_url?: string | null;
}

/**
 * List the files in a repository directory (e.g. "public/images/articles").
 * Returns an empty array for missing directories. Works in every auth mode.
 */
export async function listDirectory(
    path: string,
    options: { config?: StudioConfig } = {},
): Promise<StudioContentEntry[]> {
    const cfg = options.config ?? getStudioConfig();
    if (!cfg && !hasApi()) return [];

    try {
        const data = await api<StudioContentEntry[] | StudioContentEntry>(
            `/repos/${cfg?.owner ?? DEFAULT_OWNER}/${cfg?.repo ?? DEFAULT_REPO}/contents/${path}?ref=${encodeURIComponent(cfg?.branch ?? DEFAULT_BRANCH)}`,
            undefined,
            cfg ?? undefined,
        );
        return Array.isArray(data) ? data : [];
    } catch (err) {
        // Structured 404 (OAuth/team mode) or legacy message prefix (PAT mode)
        if (err instanceof GitHubApiError && err.status === 404) return [];
        if (err instanceof Error && /^GitHub API 404/.test(err.message)) {
            return [];
        }
        throw err;
    }
}

/**
 * Delete a file from the repository (Contents API DELETE). Resolves the
 * current sha itself, so callers only need the path. Returns false when the
 * file does not exist.
 */
export async function deleteFile(
    path: string,
    message: string,
    options: { config?: StudioConfig } = {},
): Promise<boolean> {
    const cfg = options.config ?? getStudioConfig();
    if (!cfg && !hasApi()) return false;

    const existing = await getFile(path, {
        config: cfg ?? undefined,
        decode: false,
    });
    if (!existing?.sha) return false;

    const body: Record<string, string> = {
        message,
        sha: existing.sha,
        branch: cfg?.branch ?? DEFAULT_BRANCH,
    };

    await api(
        `/repos/${cfg?.owner ?? DEFAULT_OWNER}/${cfg?.repo ?? DEFAULT_REPO}/contents/${path}`,
        { method: "DELETE", body: JSON.stringify(body) },
        cfg ?? undefined,
    );
    return true;
}

/** Verify connectivity: OAuth session (worker) or token+repo (legacy). */
export async function testGitHubConnection(
    config?: StudioConfig,
): Promise<{ ok: boolean; message: string }> {
    const apiBase = getApiBase();

    if (apiBase) {
        const session = await getSession();
        if (!session?.authenticated) {
            return {
                ok: false,
                message: "Not signed in. Sign in to connect the Studio.",
            };
        }
        const via =
            getAuthMode() === "oauth" ? "GitHub OAuth" : "Studio account";
        return {
            ok: true,
            message: `Connected as ${session.user?.login || "a Studio user"} (via ${via}).`,
        };
    }

    const cfg = config ?? getStudioConfig();
    if (!cfg?.token) {
        return { ok: false, message: "Add a GitHub token to test the connection." };
    }

    try {
        const data = await api<{
            full_name?: string;
            permissions?: { push?: boolean };
        }>(`/repos/${cfg.owner}/${cfg.repo}`, undefined, cfg ?? undefined);

        if (!data.full_name) {
            return { ok: false, message: "Repository not found." };
        }

        if (data.permissions?.push === false) {
            return {
                ok: false,
                message: `Connected to ${data.full_name}, but this token cannot write to it. Recreate the token with “Contents: Read and write” on this repo.`,
            };
        }

        const access =
            data.permissions?.push === true
                ? "with write access"
                : "write access could not be verified";
        return {
            ok: true,
            message: `Connected to ${data.full_name} (branch: ${cfg.branch}) — ${access}.`,
        };
    } catch (err) {
        return {
            ok: false,
            message: err instanceof Error ? err.message : String(err),
        };
    }
}

/* ------------------------------------------------------------------ */
/* Encoding helpers                                                    */
/* ------------------------------------------------------------------ */

function stringToBase64(value: string): string {
    const bytes = new TextEncoder().encode(value);
    let binary = "";
    for (const byte of bytes) binary += String.fromCharCode(byte);
    return btoa(binary);
}

function base64ToString(value: string): string {
    const binary = atob(value);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
    }
    return new TextDecoder().decode(bytes);
}

/** Read an uploaded image file as a raw base64 data string (no header). */
export function fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
            const result = String(reader.result || "");
            const base64 = result.split(",")[1] ?? "";
            resolve(base64);
        };
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(file);
    });
}

/* ------------------------------------------------------------------ */
/* Slug + frontmatter serialization                                   */
/* ------------------------------------------------------------------ */

export function slugify(value: string): string {
    const slug = value
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "")
        .slice(0, 80);
    return slug || "article";
}

function yamlScalar(value: string): string {
    if (/[\r\n]/.test(value)) {
        const lines = value
            .split(/\r?\n/)
            .map((line) => `  ${line}`)
            .join("\n");
        return `>-\n${lines}`;
    }
    return `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

/**
 * Serialize article metadata + markdown body into the same .md format the
 * existing articles use (frontmatter followed by the body).
 */
export function serializeArticle(
    article: ArticleData,
    body: string,
): string {
    const lines: string[] = ["---"];

    lines.push(`title: ${yamlScalar(article.title)}`);
    lines.push(`description: ${yamlScalar(article.description)}`);
    lines.push(`pubDate: ${article.pubDate}`);

    if (article.updatedDate) {
        lines.push(`updatedDate: ${article.updatedDate}`);
    }

    lines.push(`author: ${yamlScalar(article.author)}`);
    lines.push(`category: ${yamlScalar(article.category)}`);

    if (article.tags.length > 0) {
        lines.push("tags:");
        for (const tag of article.tags) lines.push(`  - ${yamlScalar(tag)}`);
    } else {
        lines.push("tags: []");
    }

    lines.push(`featured: ${article.featured ? "true" : "false"}`);
    lines.push(`draft: ${article.draft ? "true" : "false"}`);
    if (article.archived) lines.push("archived: true");

    if (article.heroImage) lines.push(`heroImage: ${yamlScalar(article.heroImage)}`);
    if (article.featuredImageAlt) {
        lines.push(`featuredImageAlt: ${yamlScalar(article.featuredImageAlt)}`);
    }
    if (article.seoTitle) lines.push(`seoTitle: ${yamlScalar(article.seoTitle)}`);
    if (article.seoDescription) {
        lines.push(`seoDescription: ${yamlScalar(article.seoDescription)}`);
    }
    if (article.canonicalURL) {
        lines.push(`canonicalURL: ${yamlScalar(article.canonicalURL)}`);
    }

    lines.push("---", "");

    const normalizedBody = body.replace(/^\s*\n/, "");
    lines.push(normalizedBody);

    return lines.join("\n").trimEnd() + "\n";
}
