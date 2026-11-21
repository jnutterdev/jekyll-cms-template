# Tech Spec: Jekyll + Decap CMS Template

## Goal

A Jekyll starter, same as `jekyll-template` (layouts, tokens, Bunny Fonts, `/pattern-lib`), with a browser-based editor at `/admin` for posts and pages. Content stays as markdown in git, so Jekyll remains the source of truth and the site stays fully static on Cloudflare Pages.

## Non-goals

- No database and no app server. The only runtime piece is a small OAuth Worker.
- No editorial workflow (draft PRs, review states) in v1.
- No multi-user roles. Anyone with push access to the repo can edit.

## Architecture

```
Browser ── /admin (Decap, static) ──► GitHub API (commits markdown)
              │
              └─ login popup ──► OAuth Worker (Hono, Cloudflare Workers) ──► GitHub OAuth
Push to main ──► Cloudflare Pages build (bundle exec jekyll build) ──► deployed site
```

| Piece | Where | Notes |
| --- | --- | --- |
| Decap CMS | `admin/index.html` | Loaded from unpkg, pinned to a minor version. No build step. |
| CMS config | `admin/config.yml` | Backend, media folder, collections |
| Uploads | `assets/uploads/` | Committed to the repo by Decap |
| OAuth proxy | `oauth/` | Separate Worker, deployed with wrangler. Excluded from the Jekyll build. |
| Local editing | `decap-server` | Writes straight to the working copy. No GitHub login needed. |

## Collections

**Posts** (`_posts/`, folder collection, create enabled)

| Field | Widget | Front matter |
| --- | --- | --- |
| Layout | hidden, `post` | `layout` |
| Title | string | `title` |
| Date | datetime | `date` |
| Tags | list | `tags` |
| Body | markdown | file body |

Filename: `{{year}}-{{month}}-{{day}}-{{slug}}.md`, which matches Jekyll's post naming.

**Pages** (files collection, edit only)

- `index.md`: layout `home`, body
- `about.md`: layout `page`, title, permalink, body

New pages are added in code, not through the CMS. Permalinks and nav live in `_config.yml`, and letting editors create pages would leave orphaned URLs.

## Auth: OAuth Worker

Netlify Identity / Git Gateway only works on Netlify, so on Cloudflare the GitHub backend needs its own OAuth handshake.

Routes (Hono):

- `GET /auth`: generates a random `state`, stores it in a short-lived HttpOnly cookie, and redirects to `github.com/login/oauth/authorize` with `scope=repo`. Use `public_repo` if the site repo is public.
- `GET /callback`: checks `state` against the cookie and exchanges `code` for a token. It returns a small HTML page that runs Decap's postMessage handshake (`authorizing:github`, then `authorization:github:success:{token}`).

Security:

- `state` is checked to prevent login CSRF.
- The token is sent with `postMessage` only to the origin in `ALLOWED_ORIGIN`, never to `*`.
- `GITHUB_CLIENT_SECRET` is stored as a wrangler secret and is never committed.

Config:

| Name | Kind | Example |
| --- | --- | --- |
| `GITHUB_CLIENT_ID` | var (`wrangler.toml`) | from the GitHub OAuth app |
| `GITHUB_CLIENT_SECRET` | secret | `wrangler secret put GITHUB_CLIENT_SECRET` |
| `ALLOWED_ORIGIN` | var | `https://example.com` |

GitHub OAuth app callback URL: `https://<worker-host>/callback`.

## New dependencies

- **Decap CMS 3.x**: CDN script in `/admin`.
- **decap-server**: local dev only, run with `pnpm dlx`.
- **hono**, **wrangler**, **@cloudflare/workers-types**, **typescript**: in `oauth/` only.

The Jekyll site itself gets no new gems.

## Per-site setup

1. Set `backend.repo` in `admin/config.yml` to `owner/repo`.
2. Create a GitHub OAuth app, then set `GITHUB_CLIENT_ID` and `ALLOWED_ORIGIN` in `oauth/wrangler.toml`.
3. `cd oauth && pnpm install && pnpm exec wrangler secret put GITHUB_CLIENT_SECRET && pnpm run deploy`
4. Set `backend.base_url` in `admin/config.yml` to the Worker URL.

## Open questions

- Should `/admin` be behind Cloudflare Access as well, as defense in depth? GitHub auth already limits editing to collaborators.
- Should the OAuth Worker be one shared deployment for all sites (multiple allowed origins) or one per site? v1 uses one per site.
- Editorial workflow (`publish_mode: editorial_workflow`) for draft review via PRs: later.
