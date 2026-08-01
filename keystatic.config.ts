import { config, collection, fields } from "@keystatic/core";

// Keep in sync with src/lib/author.ts (AUTHORS).
// AUTHORS is not imported directly because it uses import.meta.env,
// which is unavailable in this Node-side config file.
const AUTHORS = ["Israel Alabi"];

export default config({
    storage: {
        kind: "local",
    },

    collections: {
        articles: collection({
            label: "Articles",

            slugField: "title",

            // Must match the glob loader base in src/content.config.ts
            path: "src/content/articles/*",

            // Write the markdown body below the frontmatter, exactly like the
            // existing .md files in src/content/articles/. The explicit extension
            // is required — without it Keystatic defaults to .mdoc, which the
            // site's content collection (pattern "**/*.{md,mdx}") never loads.
            format: {
                contentField: "content",
                extension: "md",
            },

            schema: {
                title: fields.slug({
                    name: {
                        label: "Title",
                        description:
                            "The article headline. Also used to generate the file name.",
                    },
                }),

                description: fields.text({
                    label: "Description",
                    description:
                        "Short summary shown on cards, listing pages and search results.",
                    multiline: true,
                }),

                pubDate: fields.date({
                    label: "Published Date",
                }),

                updatedDate: fields.date({
                    label: "Updated Date",
                    description: "Optional. Leave empty if the article was never updated.",
                }),

                author: fields.select({
                    label: "Author",
                    description: "Choose the author of this article.",
                    options: AUTHORS.map((name) => ({ label: name, value: name })),
                    defaultValue: "Israel Alabi",
                }),

                category: fields.text({
                    label: "Category",
                    description:
                        "e.g. Cybersecurity, Consumer Tech, Software, Editorial. Used on category pages.",
                }),

                tags: fields.array(
                    fields.text({
                        label: "Tag",
                    }),
                    {
                        label: "Tags",
                        description: "Used on tag pages and related-article matching.",
                        // For a single text element the array item's preview props
                        // expose the value directly (props.value), not props.fields.
                        itemLabel: (props) => props.value || "Tag",
                    },
                ),

                featured: fields.checkbox({
                    label: "Featured",
                    description:
                        "Featured articles appear in the Editor's Picks section on the homepage.",
                    defaultValue: false,
                }),

                draft: fields.checkbox({
                    label: "Draft",
                    description:
                        "Drafts are excluded from the published site (stays true while you work).",
                    defaultValue: false,
                }),

                // Hero image + its alt text are paired, so they sit together in the
                // form: upload the image, then fill in its alt text right below.
                heroImage: fields.image({
                    label: "Hero Image",
                    description:
                        "Upload the article's main image. It is saved to public/images/articles/ automatically.",
                    directory: "public/images/articles",
                    publicPath: "/images/articles/",
                }),

                featuredImageAlt: fields.text({
                    label: "Hero Image Alt Text",
                    description:
                        "Describe the hero image for accessibility and SEO. Required if a hero image is set.",
                }),

                // SEO / Meta fields — grouped together at the bottom of the form.
                seoTitle: fields.text({
                    label: "SEO Title",
                    description:
                        "Optional. Overrides the <title> tag shown in search results.",
                }),

                seoDescription: fields.text({
                    label: "SEO Description",
                    description:
                        "Optional. Overrides the meta description shown in search results.",
                    multiline: true,
                }),

                canonicalURL: fields.text({
                    label: "Canonical URL",
                    description:
                        "Optional. The canonical URL for this article, if different from its auto-generated one.",
                }),

                content: fields.document({
                    label: "Content",
                    description:
                        "The article body. This is the markdown content below the frontmatter.",
                    formatting: true,
                    dividers: true,
                    links: true,
                    tables: true,
                    // Read/write standard Markdown (the existing .md files use plain
                    // markdown, not Markdoc).
                    output: "markdown",
                }),
            },
        }),
    },
});
