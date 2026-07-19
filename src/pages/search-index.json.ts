import { getPublishedArticles } from "../lib/articles";
import { buildSearchIndex } from "../lib/search";

export async function GET() {
    const articles = await getPublishedArticles();

    const searchIndex = buildSearchIndex(articles);

    return new Response(
        JSON.stringify(searchIndex, null, 2),
        {
            headers: {
                "Content-Type": "application/json",
                "Cache-Control": "public, max-age=3600",
            },
        },
    );
}