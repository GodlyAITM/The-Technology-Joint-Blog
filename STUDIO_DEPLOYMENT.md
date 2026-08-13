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
  | `/studio/media` | Media library — upload, copy paths and delete images |
  | `/studio/settings` | Account, GitHub connection and analytics setup |
  | `/studio/login` | Sign-in gate (PAT / team account / GitHub OAuth) |

- Saving an article commits the Markdown (and any hero image) straight to
  this repository via the GitHub Contents API. The existing GitHub Actions
  workflow then rebuilds and deploys the site automatically (a few minutes).
- A scheduled workflow (`.github/workflows/scheduled-publish.yml`) rebuilds
  hourly, so articles with a future `pubDate` go live automatically once
  their time passes.

## Authentication modes

The Studio supports three auth modes, selected by build-time env vars
(GitHub Actions variables):

| Mode | When | Who can publish |
| --- | --- | --- |
| **PAT** (default) | no `PUBLIC_STUDIO_API_URL` | anyone with the personal access token (per device) |
| **Team login** (recommended) | `PUBLIC_STUDIO_API_URL` set, `PUBLIC_STUDIO_AUTH_MODE=team` (or unset) | anyone who registers a username/password with the invite code |
| **GitHub OAuth** (optional) | `PUBLIC_STUDIO_API_URL` set, `PUBLIC_STUDIO_AUTH_MODE=oauth` | GitHub accounts via the Cloudflare worker (`studio-api/`) |

> **Note:** when `PUBLIC_STUDIO_API_URL` is set and `PUBLIC_STUDIO_AUTH_MODE` is
> left unset, the Studio uses **team** mode. If you previously pointed
> `PUBLIC_STUDIO_API_URL` at the Cloudflare OAuth worker, set
> `PUBLIC_STUDIO_AUTH_MODE=oauth` to keep the GitHub sign-in flow.

### 1. PAT mode (default, no server)

1. Open `https://godlyaitm.github.io/The-Technology-Joint-Blog/studio/login`,
   then go to Studio → **Settings**.
2. Create a **fine-grained personal access token** on GitHub
   (Settings → Developer settings → Fine-grained tokens) with:
   - Repository access: `GodlyAITM/The-Technology-Joint-Blog`
   - Permissions: **Contents: Read and write**, **Workflows: Read and write**
3. Paste the token into Studio → Settings → save. The token is kept for the
   current browser session only (`sessionStorage`), so every fresh visit
   asks to sign in again.

### 2. Team login (recommended — one shared token, many accounts)

You (the owner) provide **one** GitHub token and it is stored server-side.
Editors register a username/password (with a secret invite code) and are
automatically granted access through that shared token — no GitHub account
or token needed per person.

**Deploy the API (Vercel):**

1. Push this repo to GitHub, then import it in Vercel
   (vercel.com → Add New → Project).
2. In **Settings → General**, set the project **Root Directory** to
   `studio-api`. Framework Preset: *Other*. No build command, no output
   directory.
3. Add a **KV store** (Storage → Create KV → connect it to the project) —
   the free tier easily covers a small editorial team.
4. Set these **Environment Variables** on the Vercel project:

   | Variable | Value |
   | --- | --- |
   | `SHARED_PAT` | Your fine-grained GitHub token (`Contents` + `Workflows` read/write on the blog repo). **Never share this.** |
   | `COOKIE_SECRET` | Long random string — `openssl rand -base64 32` |
   | `INVITE_CODE` | Secret code editors must enter to register. Rotate anytime. |
   | `KV_REST_API_URL` / `KV_REST_API_TOKEN` | Auto-added when you attach the KV store |
   | `SITE_ORIGIN` | `https://godlyaitm.github.io,http://localhost:4321,http://127.0.0.1:4321` |

5. Point the site at it. In the repo's GitHub **Actions → Variables** set:

   - `PUBLIC_STUDIO_API_URL` = `https://<your-project>.vercel.app`
   - `PUBLIC_STUDIO_AUTH_MODE` = `team`

6. Push to `main` (or re-run the deploy workflow). The Studio login page
   now shows **Sign in / Create account** forms. Share the registration
   link + invite code with your editors — creating an account signs them
   straight in with full publishing access.

**Security notes:**

- The shared token grants write access to anyone who logs in — keep the
  team small and trusted, and scope the token to only this repository.
- Login is rate-limited (per IP and per account) to blunt brute force.
- Passwords are stored as salted scrypt hashes; sessions are encrypted
  HttpOnly cookies; the token never ships to the browser.
- Sessions last **7 days** (`Max-Age`) so editors stay signed in between
  visits; sign out from the Studio sidebar to end a session early.
- API requests from origins outside `SITE_ORIGIN` are rejected outright
  (CSRF defense) — keep that allowlist up to date.
- To revoke an editor, rotate `SHARED_PAT` (removes everyone) — account
  removal from KV is manual for now.

### 3. GitHub OAuth (optional)

Deploy the Cloudflare Worker in `studio-api/` (`wrangler deploy`) with the
secrets listed in `studio-api/wrangler.toml`, then set `PUBLIC_STUDIO_API_URL`
and `PUBLIC_STUDIO_AUTH_MODE=oauth` on the site build.

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
- The login gate is a client-side check against the configured mode; the
  pages are `noindex`ed so they don't appear in search results.
- Local dev with team mode: run `vercel dev` inside `studio-api/` and set
  `PUBLIC_STUDIO_API_URL=http://localhost:3000` (plus `PUBLIC_STUDIO_AUTH_MODE=team`)
  in a local `.env` file for the Astro build.
