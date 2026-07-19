import { defineConfig } from "astro/config";
import sitemap from "@astrojs/sitemap";

const site =
    process.env.PUBLIC_SITE_URL ??
    "https://your-github-username.github.io/the-technology-joint-blog";

export default defineConfig({
    site,

    integrations: [
        sitemap(),
    ],

    build: {
        format: "directory",
    },
});