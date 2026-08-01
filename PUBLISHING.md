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

Article hero images live in `public/images/articles/`. The image file must be a real image file (PNG/JPG), not a text file containing a path.

### How to add an article image (step by step)

1. Keep the image somewhere easy to find, e.g. your `Downloads` folder.
2. Rename the file to match your article slug, e.g. for the article `best-antivirus-software-2026.md`, use `best-antivirus-software-2026.png`. Use only lowercase letters, numbers and dashes (no spaces, no brackets, no `(1)`).
3. Copy (not move) the real image file into `public/images/articles/`.
4. In the article's frontmatter, set `heroImage` to `/images/articles/your-file-name.png` (a URL starting with `/`, matching the file you copied).
5. Optional but recommended: add `featuredImageAlt` with a short description of the image.

### Common mistake to avoid (this broke the article images before)

Do NOT create the image file by typing or copying a file path (like `c:\Users\...\Downloads\image (1).png`) into the file. A file that contains only a Windows path is not an image — it will show up as a broken image on the site.

Quick check that the image was copied correctly:

- The file size should be in kilobytes (KB) or megabytes (MB), not 20–80 bytes.
- In Windows Explorer, the "Type" column should say `PNG File` or `JPG File`, not `Text Document`.
- In your editor, opening the file should NOT show text like `c:\Users\...`.

Tip: When you see filenames like `image (1).png`, rename them to something meaningful (like the article slug) so you know which image goes with which article.

Founder and logo

- Put the founder photo at `public/images/founder.jpg` (used by the Founder section).
- Put the site logo at `public/images/logo.jpg` (used in the header). 

Testing

- Run `npm run dev` to preview locally (then open the link it prints, usually http://localhost:4321).
- Build with `npm run build` and `npm run preview` to check production output.

### Getting your changes live (commit and push)

The site deploys automatically with GitHub Actions whenever you push to the `main` branch. After adding an article and its image:

1. Open a terminal in the project folder (`the-technology-joint-blog`).
2. Stage the changes: `git add -A`
3. Commit them: `git commit -m "Add new article"`
4. Push: `git push origin main`
5. Watch the deployment run at github.com -> your repo -> Actions tab. When the green check appears, your article is live.

If you'd like, I can add a small script or GitHub Action to validate frontmatter automatically before publishing.