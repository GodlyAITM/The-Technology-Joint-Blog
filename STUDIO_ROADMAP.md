# Technology Joint Studio Roadmap

## Overview

The public website is already a static Astro blog powered by local Markdown content under src/content/articles. The most stable approach is to build a private Studio experience that extends this existing model rather than replacing it. The Studio will act as a content-authoring layer that writes Markdown files, image assets, and metadata into the existing content structure so the public site remains unchanged and fully static.

## Recommended Architecture

### 1. Preserve the public site as-is
- Keep the current Astro routing and page generation intact.
- Leave existing article pages, categories, tags, RSS, and SEO behavior unchanged.
- Avoid introducing client-side runtime dependencies into the public bundle that are only needed for Studio features.

### 2. Add a private Studio surface under a dedicated route
- Use a protected Studio area such as /studio.
- Keep this route server-only and inaccessible to public viewers in the deployed build.
- The Studio UI can be implemented as a lightweight React/ Astro integration with its own isolated components.

### 3. Bridge Studio edits to the local content filesystem
- The Studio will create and edit Markdown files under src/content/articles.
- Frontmatter will stay compatible with the existing content schema used by Astro.
- Images uploaded in Studio will be written into public/images/articles and referenced with the same path conventions already used by the site.
- This means the public website continues to render from the same content source it already uses today.

## Technical Plan

### Phase 0: Discovery and foundation
- Confirm the current content schema in src/content.config.ts.
- Use the existing local Markdown workflow as the canonical source of truth.
- Document a proposed Studio route structure and file-writing strategy.

### Phase 1: Authentication and access control
- Add a private Studio route protected by authentication.
- Start with a simple local-auth or email/password fallback to avoid unnecessary third-party setup.
- Introduce roles for Admin, Editor, and Writer, with the current signed-in user defaulting to Writer.
- Keep authentication isolated from the public site so normal visitors are unaffected.

### Phase 2: Studio dashboard shell
- Build a sidebar-based admin layout inspired by modern dashboards.
- Include cards for published posts, drafts, views, and recent activity.
- Support light/dark mode using the site’s existing design tokens for consistency.

### Phase 3: Article management and editor
- Build a listing view with create, edit, duplicate, archive, search, and filter actions.
- Provide a form-based editor for article metadata and a markdown body editor.
- Add live preview, autosave, word count, and reading-time estimates.
- Auto-save content as Markdown files into the existing article content directory.

### Phase 4: Media library and SEO tools
- Add a media management area that stores uploaded files inside public/images/articles.
- Support drag-and-drop upload and basic image optimization workflow.
- Include SEO helpers such as meta length indicators, Open Graph preview, alt-text warnings, and keyword focus suggestions.

### Phase 5: AI assist and analytics placeholders
- Add a slide-out assistant panel that suggests improvements rather than modifying content automatically.
- Traffic stats integrated via Simple Analytics (public JSON endpoint); editorial stats live on the dashboard.
- Add settings panels for brand defaults, SEO defaults, and user profile preferences.

## Implementation Notes

### Content format compatibility
- Keep frontmatter keys compatible with the current schema: title, description, pubDate, updatedDate, author, category, tags, featured, draft, heroImage, featuredImageAlt, seoTitle, seoDescription, and canonicalURL.
- Preserve article body markdown so existing rendering logic continues to work.

### File-system integration
- New articles should be written as .md files under src/content/articles.
- Uploaded images should be copied into public/images/articles with sensible filenames.
- Any Studio-generated content should follow the same conventions as existing articles to preserve SEO and layout behavior.

### Performance and safety
- Load Studio-specific code only inside the protected Studio route.
- Avoid adding editor libraries to the public site bundle.
- Keep the public build path unchanged and ensure Studio features remain opt-in.

## Suggested Milestones

1. Create the private Studio route and shell.
2. Implement authentication and role-based access.
3. Add article list and editor workflows.
4. Add media library and SEO helpers.
5. Add AI assistant and analytics placeholders.

## Recommendation

This project already has a strong content foundation through Astro + local Markdown. The safest path is to evolve that model into a private Studio experience rather than introducing a separate database-backed CMS. That preserves the current static site performance, SEO, and URL structure while giving editors a modern publishing workflow.
