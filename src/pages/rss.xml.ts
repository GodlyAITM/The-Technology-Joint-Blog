import rss from "@astrojs/rss";
import { SITE } from "../config/site";
import { getPublishedArticles } from "../lib/articles";

export async function GET() {
    const articles = await getPublishedArticles();

    return rss({
        title: SITE.name,
        description: SITE.description,
        site: SITE.url,

        items: articles.map((article) => ({
            title: article.data.title,
            description: article.data.description,
            pubDate: article.data.pubDate,

            link: `/articles/${article.id}/`,
        })),
    });
}