import { defineConfig } from "astro/config";
import sitemap from "@astrojs/sitemap";

export default defineConfig({
    site: "https://godlyaitm.github.io/the-technology-joint-blog",

    base: "/the-technology-joint-blog/",

    integrations: [
        sitemap(),
    ],

    build: {
        format: "directory",
    },
});