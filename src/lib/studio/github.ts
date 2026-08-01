/**
 * Client-side GitHub API helpers for the Studio workspace.
 *
 * The Studio is a fully static site (GitHub Pages), so it has no backend.
 * Saving/publishing therefore uses the GitHub Contents API directly from the
 * browser with a personal access token. Pushing to `main` triggers the
 * existing GitHub Actions deploy, which rebuilds the live site.
 *
 * NOTE: the token is stored in localStorage. That is acceptable for this
 * private single-editor tool, but never expose the Studio to untrusted users.
 */

export interface StudioConfig {
    owner: string;
    repo: string;
    branch: string;
    token: string;
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
    heroImage?: string;
    featuredImageAlt?: string;
    seoTitle?: string;
    seoDescription?: string;
    canonicalURL?: string;
}

const STORAGE_KEY = "studio-github-config";
const API = "https://api.github.com";

export const DEFAULT_OWNER = "godlyaitm";
export const DEFAULT_REPO = "The-Technology-Joint-Blog";
export const DEFAULT_BRANCH = "main";

/* ------------------------------------------------------------------ */
/* Config / token storage                                              */
/* ------------------------------------------------------------------ */

export function getStudioConfig(): StudioConfig | null {
    try {
        const raw = window.localStorage.getItem(STORAGE_KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw) as Partial<StudioConfig>;
        if (!parsed.token || !parsed.owner || !parsed.repo) return null;
        return {
            owner: parsed.owner,
            repo: parsed.repo,
            branch: parsed.branch || DEFAULT_BRANCH,
            token: parsed.token,
        };
    } catch {
        return null;
    }
}

export function saveStudioConfig(config: StudioConfig): void {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
}

export function hasStudioConfig(): boolean {
    return getStudioConfig() !== null;
}

/* ------------------------------------------------------------------ */
/* Low-level API call                                                  */
/* ------------------------------------------------------------------ */

interface GitHubContentResult {
    sha?: string;
    content?: string;
    message?: string;
}

async function api<T = GitHubContentResult>(
    path: string,
    init?: RequestInit,
    config?: StudioConfig,
): Promise<T> {
    const cfg = config ?? getStudioConfig();
    if (!cfg) {
        throw new Error(
            "GitHub is not connected. Open Studio → Settings and save your token.",
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
        // Keep the HTTP status in the message — callers (e.g. getFile's
        // "file not found" detection) rely on the "GitHub API 404" prefix.
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
    if (!cfg) return null;

    try {
        const data = await api<GitHubContentResult>(
            `/repos/${cfg.owner}/${cfg.repo}/contents/${path}?ref=${encodeURIComponent(cfg.branch)}`,
            undefined,
            cfg,
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
    if (!cfg) {
        throw new Error(
            "GitHub is not connected. Open Studio → Settings and save your token.",
        );
    }

    const body: Record<string, string> = {
        message,
        content: options.base64 ? content : stringToBase64(content),
        branch: cfg.branch,
    };
    if (options.sha) body.sha = options.sha;

    return api<GitHubContentResult>(
        `/repos/${cfg.owner}/${cfg.repo}/contents/${path}`,
        { method: "PUT", body: JSON.stringify(body) },
        cfg,
    );
}

/** Verify the token + repo are reachable and writable. */
export async function testGitHubConnection(
    config: StudioConfig,
): Promise<{ ok: boolean; message: string }> {
    try {
        const data = await api<{
            full_name?: string;
            permissions?: { push?: boolean };
        }>(`/repos/${config.owner}/${config.repo}`, undefined, config);

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
            message: `Connected to ${data.full_name} (branch: ${config.branch}) — ${access}.`,
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
