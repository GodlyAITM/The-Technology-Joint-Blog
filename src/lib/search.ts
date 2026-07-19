import type { Article } from "./articles";

export interface SearchDocument {
    id: string;
    title: string;
    description: string;
    category: string;
    tags: string[];
    author: string;
    url: string;
}

export function buildSearchIndex(
    articles: Article[],
): SearchDocument[] {

    return articles.map((article) => ({

        id: article.id,

        title: article.data.title,

        description: article.data.description,

        category: article.data.category,

        tags: article.data.tags,

        author: article.data.author,

        url: `/articles/${article.id}/`,

    }));

}

export function searchArticles(
    query: string,
    documents: SearchDocument[],
): SearchDocument[] {

    if (!query.trim()) {
        return [];
    }

    const term = query.toLowerCase();

    return documents.filter((doc) => {

        return (
            doc.title.toLowerCase().includes(term) ||
            doc.description.toLowerCase().includes(term) ||
            doc.category.toLowerCase().includes(term) ||
            doc.author.toLowerCase().includes(term) ||
            doc.tags.some((tag) =>
                tag.toLowerCase().includes(term),
            )
        );

    });

}