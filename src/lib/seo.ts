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

export function getImageUrl(image?: string): string {
    return new URL(
        image ?? SITE.defaultHero,
        SITE.url,
    ).toString();
}

export function getArticleUrl(slug: string): string {
    return new URL(
        `/articles/${slug}/`,
        SITE.url,
    ).toString();
}

export function getCategoryUrl(category: string): string {
    return new URL(
        `/categories/${slugify(category)}/`,
        SITE.url,
    ).toString();
}

export function getTagUrl(tag: string): string {
    return new URL(
        `/tags/${slugify(tag)}/`,
        SITE.url,
    ).toString();
}

export function getAuthorUrl(author: string): string {
    return new URL(
        `/authors/${slugify(author)}/`,
        SITE.url,
    ).toString();
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