import { defineConfig } from "astro/config";
import sitemap from "@astrojs/sitemap";
import react from "@astrojs/react";
import keystatic from "@keystatic/astro";
import vercel from "@astrojs/vercel";

// Two deployment targets, one config:
//
//  1. GitHub Pages (the public site) — a fully static build with the base
//     path set. Keystatic is NEVER enabled here: its /keystatic and
//     /api/keystatic routes are server-only (prerender: false), which would
//     break the static build and expose the admin UI publicly.
//
//  2. Studio deployment (Vercel) — where the Keystatic admin UI lives. The
//     Vercel adapter enables server rendering for the Keystatic routes
//     (they set `export const prerender = false`), while every public page
//     still prerenders statically. The site is served at the root path
//     because Keystatic's client makes root-relative calls (/keystatic,
//     /api/keystatic/...) and Keystatic Cloud's OAuth callback is
//     `<origin>/keystatic/cloud/oauth/callback`.
//
// Vercel sets VERCEL=1 automatically in its build environment. An explicit
// STUDIO_DEPLOY=true works too (e.g. for local verification).
const isStudioDeploy =
    process.env.VERCEL === "1" || process.env.STUDIO_DEPLOY === "true";

// Astro sets NODE_ENV=production for `astro build`; also guard the argv so
// preview/check never enable Keystatic on the GitHub Pages path.
const isProduction =
    process.env.NODE_ENV === "production" ||
    process.argv.includes("build") ||
    process.argv.includes("preview") ||
    process.argv.includes("check");

export default defineConfig({
    site: isStudioDeploy
        ? (process.env.PUBLIC_SITE_URL ||
              "https://godlyaitm.github.io/The-Technology-Joint-Blog")
        : "https://godlyaitm.github.io/The-Technology-Joint-Blog",

    // GitHub Pages needs the base path in the deployed build; local dev and
    // the studio deployment must run at the root so Keystatic's admin UI and
    // API resolve correctly.
    base: isStudioDeploy ? "/" : isProduction ? "/The-Technology-Joint-Blog/" : "/",

    // Astro 7: `output: "static"` is the default. Pages with
    // `export const prerender = false` (the Keystatic /keystatic and
    // /api/keystatic routes) automatically become server-rendered when an
    // adapter is present, so the public pages stay static on Vercel while
    // the Keystatic admin runs server-side.
    output: "static",

    adapter: isStudioDeploy ? vercel() : undefined,

    integrations: [
        sitemap(),
        react(),
        (isStudioDeploy || !isProduction) && keystatic(),
    ].filter(Boolean),

    build: {
        format: "directory",
    },
});
