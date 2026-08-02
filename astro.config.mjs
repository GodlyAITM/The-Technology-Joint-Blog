import { defineConfig } from "astro/config";
import sitemap from "@astrojs/sitemap";
import react from "@astrojs/react";
import keystatic from "@keystatic/astro";

// Keystatic is a local dev-time tool only:
//  - Its /keystatic and /api/keystatic routes use server-side code
//    (prerender: false), which would break the static build and expose the
//    admin UI publicly if shipped to GitHub Pages.
//  - Its client makes root-relative API calls (/api/keystatic/...), so the
//    dev server must serve the site at the root path, not under a base path.
// Astro sets NODE_ENV=production for `astro build`; also guard the argv so
// preview/check never enable Keystatic.
const isProduction =
    process.env.NODE_ENV === "production" ||
    process.argv.includes("build") ||
    process.argv.includes("preview") ||
    process.argv.includes("check");

export default defineConfig({
    site: "https://godlyaitm.github.io/The-Technology-Joint-Blog",

    // GitHub Pages needs the base path in the deployed build; local dev must
    // run at the root so Keystatic's admin UI and API resolve correctly.
    base: isProduction ? "/The-Technology-Joint-Blog/" : "/",

    integrations: [
        sitemap(),
        react(),
        !isProduction && keystatic(),
    ].filter(Boolean),

    build: {
        format: "directory",
    },
});
