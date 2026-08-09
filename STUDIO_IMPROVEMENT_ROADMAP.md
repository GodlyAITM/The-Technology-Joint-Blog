# Studio Improvement Roadmap — Phase 0 Discovery & Diagnosis

Status: **PHASE 0 COMPLETE — awaiting confirmation before Phase 1 (no application code changed).**

---

## 1. Architecture Overview (as discovered)

| Layer | Implementation |
| --- | --- |
| Framework | Astro 7 (static output, `output: "static"`), React available, no server runtime |
| Hosting | GitHub Pages via GitHub Actions (`https://godlyaitm.github.io/The-Technology-Joint-Blog/`) |
| Base path | `/The-Technology-Joint-Blog/` in production builds; `/` in local dev |
| Content | Local Markdown in `src/content/articles/` + `src/content.config.ts` (Zod schema) |
| Studio | Static pages under `/studio/*` (dashboard, articles, editor, media, settings, login) wrapped by `StudioShell.astro` |
| Persistence | GitHub Contents API called **directly from the browser** (`src/lib/studio/github.ts`) with a Personal Access Token stored in `localStorage` |
| Auth | **Client-side only** — a `localStorage` flag (`studio-auth`) checked by an inline script in `BaseLayout.astro` + `StudioShell.astro`; `login.astro` compares **hardcoded email/password embedded in the shipped source** |
| Deploy pipeline | Push to `main` → `.github/workflows/deploy.yml` → `npm ci && npm run build` → `upload-pages-artifact` → `deploy-pages` |

Key consequence of the architecture: **there is no server runtime on GitHub Pages.** Anything that needs to run server-side (HTTP-only cookies, CSRF tokens, server-side token vaulting, rate limiting, OAuth authorization-code exchange) requires either a static-only alternative or a small serverless addition.

---

## 2. Bug Diagnosis — Blank Editor Form in Production (Objective 5)

### Root cause (confirmed)

The **committed/deployed** version of `src/pages/studio/editor.astro` reads the article slug at **build time**:

```ts
const slug = Astro.url.searchParams.get("slug") || "";
```

For a statically generated site, `Astro.url.searchParams` is **always empty at build time** — query strings only exist in the browser at request time. Every `/studio/editor?slug=…` link therefore rendered the same **blank "New article" form** in production, regardless of which article was clicked. Links were correctly generated with `?slug=` (dashboard, article manager), but the page never read them.

### Current working-tree fix (uncommitted, NOT deployed)

The working tree contains an uncommitted client-side fix (`loadArticleFromUrl()` in `editor.astro`) that:

1. Reads `window.location.search` at runtime.
2. Fetches `src/content/articles/<slug>.md` from GitHub via the Contents API.
3. Parses frontmatter with a hand-rolled YAML parser.
4. Populates the form, updates edit/duplicate state, shows hero preview and Preview link.

Verified compatible with the real article files (quoted scalars, plain tag arrays, `heroImage`, `featuredImageAlt`, `seoTitle`, `seoDescription`, `canonicalURL`, `updatedDate` all parse correctly).

### Why the fix alone does not fully close the loop

- **It is not deployed.** Production still runs the old build-time read. First deployment action: commit + ship the client-side fix.
- **It requires a connected GitHub token** on the same browser/device. If `localStorage` has no `studio-github-config`, the editor shows "GitHub is not connected" and the form stays empty — still effectively a blank form.
- It depends on a hand-rolled YAML parser (fragile for edge cases: quoted `#` values, multi-line arrays, escaped quotes).

**Fix plan (Phase 1):** commit & deploy the client-side load path, harden the parser (or reuse a tiny battle-tested YAML parser), surface a clear "connect GitHub" CTA when unauthenticated, and (per Objective 4) remove the manual-PAT requirement entirely so the editor always has a working credential.

---

## 3. Bug Diagnosis — GitHub PAT Friction (Objective 4)

### Current flow

1. User visits Settings, creates a fine-grained PAT (`Contents: Read and write` + `Workflows: Read and write`) on the GitHub website.
2. Token is pasted into Settings and stored in `localStorage` (per browser/device).
3. Every new device/browser → repeat steps 1–2.

### Pain points

- **Per-device setup** — no roaming session; the token is re-entered on every device.
- **Token lives in `localStorage`** — readable by any script on the page (XSS-exposed), not revocable per-session.
- **No GitHub OAuth at all** — no "Sign in with GitHub", no delegation.
- **Fake app-level login** — `login.astro` hardcodes `alabi43israel@gmail.com` / a password **in the shipped HTML/JS source**; anyone can read it or simply set `localStorage.studio-auth=authenticated`. This is the most urgent security issue found.

### Proposed direction (Phase 1)

Two viable architectures — **needs owner decision** (see questions):

**Option A — GitHub OAuth Device Flow (100% static, no backend)**
- "Sign in with GitHub" button → device code → user enters it at `github.com/login/device` → browser polls and receives an access token.
- No PAT typing, no per-device PAT creation, no `client_secret` on the client (device flow does not require one).
- Token still stored in `localStorage` (mitigation: only used against this repo, revocable in GitHub settings). Meets "seamless GitHub OAuth repository delegation"; does NOT meet HTTP-only cookies/CSRF (impossible statically).

**Option B — Small serverless backend (Cloudflare Worker / Vercel Function)**
- Real OAuth authorization-code flow, **HTTP-only cookies, CSRF tokens, server-side token vaulting, rate limiting** — meets every security requirement literally.
- Cost: adds a deploy target + service dependency (constraint conflict with "preserve the GitHub deployment pipeline"; mitigated by keeping the Worker isolated and triggered only for Studio API calls).

**Option C — Keep PAT, polish UX**
- Fastest; does not satisfy Objective 3/4 fully. Not recommended.

---

## 4. Security Audit Summary (Objective 12 — findings only)

| # | Finding | Severity |
| --- | --- | --- |
| S1 | Hardcoded login credentials committed to `src/pages/studio/login.astro` (shipped to every visitor) | **Critical** |
| S2 | Studio "authentication" is a client-side `localStorage` flag — trivially bypassed; zero real access control | **Critical** |
| S3 | GitHub PAT stored in `localStorage` in plaintext | High |
| S4 | No rate limiting / no CSRF protection on any "endpoint" (all client-side) | High (inherent to static) |
| S5 | Studio route uses `noindex` but pages are still publicly reachable (security through obscurity only) | Medium |
| S6 | `seoTitle`/`canonicalURL` etc. are escaped via YAML serialization; body is raw Markdown by design (no HTML injection into public site beyond normal Markdown) | Info |

---

## 5. Theme System — Current State (Objective 2 findings)

- `BaseLayout.astro` already ships a **zero-flash inline script**: reads `localStorage.theme`, falls back to `prefers-color-scheme`, sets `data-theme` before paint.
- Existing gap: only **light/dark** binary toggle; no explicit **"system"** option, no persistence of the "follow system" choice, and the toggle only cycles light↔dark.
- Phase 2 will add a 3-way control (Light / Dark / System) with the same zero-flash pattern and persisted preference.

---

## 6. Mobile / Studio Responsiveness — Current State (Objectives 1, 8 findings)

- `StudioShell.astro` has one `@media (max-width: 960px)` breakpoint that collapses the sidebar to a horizontal wrap. No 375px audit.
- `studio.css` tables (article manager) and editor rows may overflow at small widths (to verify in Phase 2).
- Public `Navigation.astro` is a simple inline list (crowded on mobile) — Phase 2 drawer/bottom-nav candidate.
- Fluid typography / touch-target audit pending.

---

## 7. Editorial Workflow — Current State (Objectives 6, 7 findings)

- Status is binary (`draft` boolean in frontmatter) — no Scheduled / Archived states.
- No autosave, no unsaved-changes warning, no last-edited timestamp, no toasts/skeletons, no split preview, no drag-and-drop media manager (media page is a stub).

---

## 8. Accessibility / Performance / PWA — Current State (Objectives 9, 10, 11 findings)

- Studio CSS is a single import inside `StudioShell` — bundles with the public site (bundle-splitting opportunity).
- No formal keyboard/focus-trap/ARIA audit; modal-less UI today.
- No PWA manifest; offline draft caching not implemented.
- Fonts/images: no explicit loading strategy audit performed yet (Phase 4).

---

## 9. Proposed Phase Execution Order

1. **Phase 1 (Bug Fixes + Auth + Security):** deploy client-side editor fix; implement chosen auth (A/B/C); remove hardcoded credentials; harden YAML parsing; sanitize/validate inputs.
2. **Phase 2 (Theme + Mobile):** 3-way theme (zero-flash preserved); mobile-first public redesign (drawer nav, fluid type, touch targets); Studio responsive pass at 375/768/desktop.
3. **Phase 3 (Studio UX):** status management (Draft/Published/Scheduled/Archived), autosave + dirty-state warnings + last-edited timestamps; split-view preview, toasts, skeletons, drag-and-drop uploads, shortcuts.
4. **Phase 4 (A11y + Performance + PWA):** keyboard/focus/ARIA/contrast audit; bundle-split Studio CSS/JS; lazy images + font loading; evaluate offline draft cache + PWA manifest.
5. **Phase 5 (QA + Deliverables):** cross-viewport verification matrix, build validation, and this document expanded into the final executive/technical/security summary.

---

*Phase 0 complete. Awaiting owner confirmation + architecture decision before writing Phase 1 application code.*
