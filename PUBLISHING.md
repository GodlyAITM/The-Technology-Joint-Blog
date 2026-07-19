Publishing workflow

- Add your Markdown files to `src/content/articles/`.
- Use `.md` or `.mdx` files.
- Use the following frontmatter keys (required/optional):
  - `title` (required)
  - `description` (required)
  - `pubDate` (required) - use ISO date or YYYY-MM-DD
  - `author` (required)
  - `category` (required)
  - `tags` (optional) - list of strings
  - `featured` (optional) - true/false
  - `draft` (optional) - true/false (drafts are excluded)
  - `heroImage` (optional) - path under `public/images/articles/`
  - `featuredImageAlt` (optional)

Images

- Place images in `public/images/articles/` (create the folder if needed).
- Use relative URLs from the site root, e.g. `/images/articles/your-image.jpg` in frontmatter or markdown.

Founder and logo

- Put the founder photo at `public/images/founder.jpg` (used by the Founder section).
- Put the site logo at `public/images/logo.png` (used in the header). 

Testing

- Run `npm run dev` to preview locally.
- Build with `npm run build` and `npm run preview` to check production output.

If you'd like, I can add a small script or GitHub Action to validate frontmatter automatically before publishing.