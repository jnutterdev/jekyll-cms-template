# Jekyll CMS Template

A no-theme, no-Sass Jekyll starter with [Decap CMS](https://decapcms.org) at `/admin`. Plain CSS with custom-property tokens, normalize.css, Bunny Fonts, and a `/pattern-lib` page. Content stays as markdown in git. See `docs/tech-spec.md` for the design.

## New site from this template

```sh
gh repo create my-new-site --template jnutterdev/jekyll-cms-template --clone --private
cd my-new-site
bundle install
bundle exec jekyll serve
```

Then:

1. Update `title`, `description`, `author`, `url`, and `nav` in `_config.yml`.
2. Swap the palette and font stacks in `assets/css/tokens.css`.
3. Update `bunny_fonts` in `_config.yml` to match the `--font-*` tokens.
4. Update descriptions in `_data/color_roles.yml` and the Type section of `pattern-lib.html`.
5. Set up the CMS (below).

## Structure

```
admin/
  index.html             loads Decap CMS (CDN, pinned ~3.18)
  config.yml             backend, media folder, collections
assets/uploads/          images uploaded through the CMS
oauth/                   GitHub OAuth Worker for Decap (Hono, not part of the site build)
docs/tech-spec.md        design notes for the CMS setup
_config.yml              site settings, nav, bunny_fonts
_data/
  color_roles.yml        swatch descriptions for /pattern-lib
  mock_posts.yml         fake posts rendered on /pattern-lib
_includes/
  head.html              meta, noindex, fonts, stylesheets (+ page.extra_css)
  fonts.html             Bunny Fonts link built from site.bunny_fonts
  header.html / footer.html
  section-heading.html   h2 with trailing rule
  post-card.html         card used on home + pattern-lib
  tag-list.html
_layouts/
  default.html           base shell
  home.html              intro + post grid
  page.html / post.html  prose layouts
assets/css/
  normalize.css          v8.0.1
  tokens.css             all design tokens
  global.css             element defaults, layout, site components
  prose.css              long-form content (.prose)
  pattern-lib.css        only loaded on /pattern-lib
pattern-lib.html         design system reference (noindex)
```

## Conventions

- **No Sass.** CSS is served as-is; there are no `.scss` files, so the Sass converter never runs.
- **Tokens first.** Every color, size, and spacing value comes from `tokens.css`. Palette names (`--color-rust`) feed semantic names (`--color-accent`); components use the semantic ones.
- **Minimum text size** is `--text-xs` (0.75rem / 12px).
- **Page-specific CSS** goes in its own file and is added through front matter:
  ```yaml
  extra_css:
    - /assets/css/some-page.css
  ```
- **`noindex: true`** in front matter adds `<meta name="robots" content="noindex">`.

## Pattern library

`/pattern-lib/` is deployed, isn't linked anywhere, and is noindexed.

- **Colors** are read from `tokens.css` at build time (any `--color-*` line that isn't an `rgb()` one-off), so new tokens show up automatically. Add a description in `_data/color_roles.yml`.
- **Type** samples are written by hand. Update them when font roles change. This is the section that can drift.
- **Components** render the real includes with data from `_data/mock_posts.yml`.

When you add a color, font role, ornament, or component, add it to `/pattern-lib` in the same change.

## CMS (Decap)

### Local editing

No login needed. Decap writes straight to your working copy.

```sh
bundle exec jekyll serve
pnpm dlx decap-server        # in a second terminal
```

Open `http://localhost:4000/admin/`. Commit the changes yourself.

Run both from the repo root. `decap-server` writes relative to the directory it starts in (or `GIT_REPO_DIRECTORY` if set):

| In /admin | Lands in |
| --- | --- |
| New or edited post | `_posts/YYYY-MM-DD-slug.md` |
| Edit Home / About | `index.md` / `about.md` |
| Upload an image | `assets/uploads/` |

- It writes files only. Nothing is committed or pushed; check `git status`.
- Deleting an entry in the UI deletes the file on disk.
- Local mode only kicks in on `localhost`. If you see a GitHub login button instead of plain "Login", `decap-server` isn't reachable on port 8081.

### Production login (GitHub)

Decap's Git Gateway only works on Netlify, so this repo ships a small OAuth Worker in `oauth/`.

1. Create a GitHub OAuth app (Settings → Developer settings → OAuth Apps). Callback URL: `https://<worker-host>/callback`.
2. In `oauth/wrangler.toml`, set `GITHUB_CLIENT_ID` and `ALLOWED_ORIGIN` (the site's origin, e.g. `https://example.com`). Use `GITHUB_SCOPE = "public_repo"` if the repo is public.
3. Deploy:
   ```sh
   cd oauth
   pnpm install
   pnpm exec wrangler secret put GITHUB_CLIENT_SECRET
   pnpm run deploy
   ```
4. In `admin/config.yml`, set `backend.repo` to `owner/repo` and `backend.base_url` to the Worker URL.

Anyone with push access to the repo can log in and edit. Saving in the CMS commits to `main`, which triggers a Pages build.

### Adding a collection

Add it under `collections` in `admin/config.yml`. Folder collections need `folder`, `create: true`, and a `layout` hidden field. Pages are a `files` collection. New pages are added in code, because permalinks and nav live in `_config.yml`.

## Deploying to Cloudflare Pages

- Build command: `bundle exec jekyll build`
- Output directory: `_site`
- Set `RUBY_VERSION` in the Pages environment variables if the default doesn't match your local Ruby.
