import { defineConfig } from "astro/config";
import sitemap from "@astrojs/sitemap";
import react from "@astrojs/react";

// Single deployment target: GitHub Pages, fully static.
// The Studio workspace lives at /studio on this same static site and
// commits to GitHub directly from the browser (personal access token),
// so no server adapter or CMS integration is needed.
//
// Astro sets NODE_ENV=production for `astro build`; also guard the argv so
// preview/check behave like production.
const isProduction =
    process.env.NODE_ENV === "production" ||
    process.argv.includes("build") ||
    process.argv.includes("preview") ||
    process.argv.includes("check");

export default defineConfig({
    site:
        process.env.PUBLIC_SITE_URL?.trim() ||
        "https://godlyaitm.github.io/The-Technology-Joint-Blog",

    // GitHub Pages needs the base path in the deployed build; local dev
    // runs at the root so the /studio pages resolve cleanly.
    base: isProduction ? "/The-Technology-Joint-Blog/" : "/",

    output: "static",

    integrations: [sitemap(), react()],

    build: {
        format: "directory",
    },
});
