import { defineCollection, z } from "astro:content";
import { glob } from "astro/loaders";

const articles = defineCollection({
    loader: glob({
        pattern: "**/*.{md,mdx}",
        base: "./src/content/articles",
    }),

    schema: z.object({
        title: z.string(),

        description: z.string(),

        pubDate: z.coerce.date(),

        updatedDate: z.coerce.date().optional(),

        author: z.string(),

        category: z.string(),

        tags: z.array(z.string()),

        featured: z.boolean().default(false),

        draft: z.boolean().default(false),

        heroImage: z.string().optional(),

        featuredImageAlt: z.string().optional(),

        seoTitle: z.string().optional(),

        seoDescription: z.string().optional(),

        canonicalURL: z.string().optional(),
    }),
});

export const collections = {
    articles,
};