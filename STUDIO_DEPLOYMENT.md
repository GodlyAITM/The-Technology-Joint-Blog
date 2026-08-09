# Studio — Publishing Workspace at /studio

The Studio is a private publishing workspace served at **`/studio`** on the
main site (GitHub Pages). It lets you draft, edit, duplicate and publish
articles that live as Markdown in `src/content/articles/` — no separate
server, CMS or deployment needed.

## How it works

- The Studio is a set of static pages (`src/pages/studio/*`) built with the
  rest of the site and served under `/studio`:

  | Page | What it does |
  | --- | --- |
  | `/studio` | Dashboard — editorial stats and recent activity |
  | `/studio/articles` | Article manager — edit or duplicate existing articles |
  | `/studio/editor` | Create a new article (draft or publish) |
  | `/studio/media` | Media notes (hero images upload per-article in the editor) |
  | `/studio/settings` | GitHub connection and analytics setup |
  | `/studio/login` | Entry gate (lightweight local session) |

- Saving an article commits the Markdown (and any hero image) straight to
  this repository via the GitHub Contents API, directly from the browser.
  The existing GitHub Actions workflow then rebuilds and deploys the site
  automatically (a few minutes).
- A scheduled workflow (`.github/workflows/scheduled-publish.yml`) rebuilds
  hourly, so articles with a future `pubDate` go live automatically once
  their time passes.

## Connecting GitHub (personal access token)

1. Open `https://godlyaitm.github.io/The-Technology-Joint-Blog/studio/login`,
   then go to Studio → **Settings**.
2. Create a **fine-grained personal access token** on GitHub
   (Settings → Developer settings → Fine-grained tokens) with:
   - Repository access: `GodlyAITM/The-Technology-Joint-Blog`
   - Permissions: **Contents: Read and write**, **Workflows: Read and write**
3. Paste the token into Studio → Settings → save. The token is kept for the
   current browser session only (`sessionStorage`), so every fresh visit
   asks to sign in again.

## Analytics

Traffic statistics in the Studio dashboard come from **Simple Analytics**
(privacy-first, cookie-less). Stats are fetched client-side from its public
JSON endpoint, so no server is required.

1. Create a website in Simple Analytics for the site domain.
2. Set the GitHub Actions variable `PUBLIC_ANALYTICS_DOMAIN` to that domain.
   The analytics script then loads on every page and the dashboard shows
   per-article pageviews.
3. (Optional) In Studio → Settings, enter the same domain to preview stats
   locally without a rebuild.

## Notes

- `npm run dev` serves the Studio locally at `http://localhost:4321/studio`.
- The login gate is a lightweight client-side check (`sessionStorage`); the
  pages are `noindex`ed so they don't appear in search results.
- The old OAuth worker (`studio-api/`) remains in the repo as an optional
  upgrade path: deploy it to Cloudflare and set `PUBLIC_STUDIO_API_URL` to
  enable GitHub OAuth sign-in instead of a token. Not required.
