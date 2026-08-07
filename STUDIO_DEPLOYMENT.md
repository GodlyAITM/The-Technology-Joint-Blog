# Studio Deployment — Keystatic Cloud on Vercel

The Studio now uses **Keystatic Cloud** for GitHub authentication and publishing.
There are **two deployments** of the same repository:

| Target | URL | What it serves |
| --- | --- | --- |
| Public site (GitHub Pages) | `https://godlyaitm.github.io/The-Technology-Joint-Blog/` | The blog itself. Fully static. **Never** exposes `/keystatic`. |
| Studio editor (Vercel) | *your-project*.vercel.app | The Keystatic admin UI at `/keystatic`. Everything else redirects to the public site. |

## How the two builds differ

`astro.config.mjs` switches behavior on the environment:

- **GitHub Pages** (`npm run build`, no `VERCEL` env): `output: "static"`, base
  `/The-Technology-Joint-Blog/`, Keystatic integration **disabled**.
- **Studio (Vercel)**: Vercel sets `VERCEL=1` automatically. The build then:
  - Enables the `@keystatic/astro` integration (which registers `/keystatic`
    and `/api/keystatic` as `prerender: false` server routes).
  - Adds the `@astrojs/vercel` adapter so those server routes can run.
  - Serves at the root path `/` (Keystatic's client + OAuth callback are
    root-relative: `https://<studio>/keystatic/cloud/oauth/callback`).

Local verification of the studio build:

```bash
STUDIO_DEPLOY=true npm run build   # produces .vercel/output
```

## Keystatic Cloud

- Config: `keystatic.config.ts` → `storage: { kind: "cloud" }`,
  `cloud: { project: "ttjb/ttjb" }`.
- Keystatic Cloud handles the GitHub OAuth flow itself. The admin UI talks to
  `api.keystatic.cloud` directly from the browser — **no site-local OAuth
  worker, no secrets in this repository**.
- Edits made in the editor commit straight to the `The-Technology-Joint-Blog`
  GitHub repository; the existing GitHub Actions workflow then rebuilds and
  deploys the public site.

## Setup checklist (do these once)

1. **Connect the repo to Vercel** (vercel.com → Add New Project →
   import `godlyaitm/The-Technology-Joint-Blog`). Vercel detects Astro, runs
   `npm run build` with `VERCEL=1`, and deploys.
   - Optional: set env var `PUBLIC_SITE_URL` on Vercel if you ever want the
     studio domain's sitemap/canonicals to point elsewhere.
2. **Keystatic Cloud → Project URLs → Primary URL**: enter the Vercel
   deployment URL, e.g. `https://ttjb-studio.vercel.app`.
3. **Visit the editor**: `https://ttjb-studio.vercel.app/keystatic` →
   **Log in with GitHub** → authorize → you're in.

## `vercel.json` redirects

`vercel.json` redirects every path except `/keystatic`, `/api/keystatic` and
`/_astro` assets to the public site, so the studio domain never serves
duplicate public content (keeps SEO clean). The editor and its assets are
served from Vercel.

## Notes

- `npm run dev` still runs Keystatic locally at `/keystatic` (root path).
- GitHub Actions deploys remain untouched: the public site still builds with
  `PUBLIC_STUDIO_API_URL` unset and deploys to GitHub Pages.
- The custom OAuth worker (`studio-api/`) is no longer needed for the studio.
  It remains in the repo as a fallback; remove it when convenient.
