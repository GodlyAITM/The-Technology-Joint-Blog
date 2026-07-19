import { getCollection, type CollectionEntry } from "astro:content";

export type Article = CollectionEntry<"articles">;

function sortNewestFirst(articles: Article[]): Article[] {
    return [...articles].sort(
        (a, b) =>
            b.data.pubDate.getTime() -
            a.data.pubDate.getTime(),
    );
}

export async function getPublishedArticles(): Promise<Article[]> {
    const articles = await getCollection(
        "articles",
        ({ data }) => !data.draft,
    );

    return sortNewestFirst(articles);
}

export async function getFeaturedArticles(): Promise<Article[]> {
    const articles = await getPublishedArticles();

    return articles.filter(
        (article) => article.data.featured,
    );
}

export async function getLatestArticles(
    limit = 6,
): Promise<Article[]> {
    const articles = await getPublishedArticles();

    return articles.slice(0, limit);
}

export async function getArticlesByCategory(
    category: string,
): Promise<Article[]> {
    const articles = await getPublishedArticles();

    return articles.filter(
        (article) =>
            article.data.category.toLowerCase() ===
            category.toLowerCase(),
    );
}

export async function getArticlesByTag(
    tag: string,
): Promise<Article[]> {
    const articles = await getPublishedArticles();

    return articles.filter((article) =>
        article.data.tags.some(
            (t) =>
                t.toLowerCase() === tag.toLowerCase(),
        ),
    );
}

export async function getRelatedArticles(
    current: Article,
    limit = 3,
): Promise<Article[]> {
    const articles = await getPublishedArticles();

    return articles
        .filter(
            (article) =>
                article.id !== current.id,
        )
        .map((article) => {
            let score = 0;

            if (
                article.data.category ===
                current.data.category
            ) {
                score += 5;
            }

            const sharedTags =
                article.data.tags.filter((tag) =>
                    current.data.tags.includes(tag),
                ).length;

            score += sharedTags;

            return {
                article,
                score,
            };
        })
        .sort((a, b) => b.score - a.score)
        .slice(0, limit)
        .map((item) => item.article);
}

export async function getAllCategories(): Promise<string[]> {
    const articles = await getPublishedArticles();

    return [
        ...new Set(
            articles.map(
                (article) => article.data.category,
            ),
        ),
    ].sort();
}

export async function getAllTags(): Promise<string[]> {
    const articles = await getPublishedArticles();

    return [
        ...new Set(
            articles.flatMap(
                (article) => article.data.tags,
            ),
        ),
    ].sort();
}

export async function getArchive(): Promise<
    Record<string, Article[]>
> {
    const articles = await getPublishedArticles();

    const archive: Record<string, Article[]> = {};

    for (const article of articles) {
        const year =
            article.data.pubDate.getFullYear().toString();

        if (!archive[year]) {
            archive[year] = [];
        }

        archive[year].push(article);
    }

    return archive;
}