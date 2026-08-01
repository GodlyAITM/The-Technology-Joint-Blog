import { SITE } from "../config/site";

export interface SEOOptions {
    pathname?: string;
    canonical?: string;
    image?: string;
}

export function getCanonicalUrl(options: SEOOptions = {}): string {
    if (options.canonical) {
        return new URL(options.canonical, SITE.url).toString();
    }

    return new URL(
        options.pathname ?? "/",
        SITE.url,
    ).toString();
}

export function getImageUrl(image?: string): string | undefined {
    if (!image) {
        return undefined;
    }

    const base = SITE.url.replace(/\/$/, "");

    const path = image.replace(/^\//, "");

    return `${base}/${path}`;
}

export function getLocalImageUrl(image?: string): string | undefined {
    if (!image) {
        return undefined;
    }

    const path = image.replace(/^\//, "");

    return `${import.meta.env.BASE_URL}${path}`;
}

export function getArticleUrl(slug: string): string {
    const base = import.meta.env.BASE_URL.replace(/\/$/, "");
    return `${base}/articles/${slug}/`;
}

export function getCategoryUrl(category: string): string {
    const base = import.meta.env.BASE_URL.replace(/\/$/, "");
    return `${base}/categories/${slugify(category)}/`;
}

export function getTagUrl(tag: string): string {
    const base = import.meta.env.BASE_URL.replace(/\/$/, "");
    return `${base}/tags/${slugify(tag)}/`;
}

export function getAuthorUrl(author: string): string {
    const base = import.meta.env.BASE_URL.replace(/\/$/, "");
    return `${base}/authors/${slugify(author)}/`;
}

export function slugify(value: string): string {
    return value
        .trim()
        .toLowerCase()
        .replace(/&/g, "and")
        .replace(/[^a-z0-9\s-]/g, "")
        .replace(/\s+/g, "-")
        .replace(/-+/g, "-");
}

export function buildPageTitle(title?: string): string {
    if (!title) {
        return SITE.title;
    }

    return `${title} | ${SITE.name}`;
}

export function buildMetaDescription(description?: string): string {
    return description ?? SITE.description;
}

export function buildRobots(noindex = false): string {
    return noindex
        ? "noindex,nofollow"
        : "index,follow";
}

export function isAbsoluteUrl(url: string): boolean {
    return /^https?:\/\//i.test(url);
}