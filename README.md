# Thavanesh Nagarajan — Portfolio + CMS

An interactive 3D portfolio (curved WebGL carousel, liquid profile portal,
editorial case studies) with a built-in content management system at `/admin`.

Next.js 16 · React 19 · React Three Fiber · PostgreSQL (Drizzle ORM) · GSAP · Lenis

---

## Quick start (local)

```bash
npm install
npm run db:seed     # creates the database, the first admin, imports your projects
npm run dev         # http://localhost:3000  ·  dashboard: http://localhost:3000/admin
```

- No database install needed locally: when `DATABASE_URL` is unset the CMS uses
  **PGlite** (real Postgres compiled to WebAssembly). It runs in memory and is
  saved to one file, `./.data/db.tar.gz`, about 2 seconds after every change.
  Each save is written to a temporary file first and then swapped in, so closing
  the window, a crash or a power cut can't leave a half-written database.
  A backup copy goes to `.data/backups` on every start (newest 10 kept).
- The first admin's email/password come from `.env.local` (`ADMIN_EMAIL`,
  `ADMIN_PASSWORD`). Copy `.env.example` to create it on a new machine.
- Only one copy of the site can use the database at a time (a lock file
  enforces it): stop `npm run dev` before running `npm run build` or the
  `db:*` scripts.

| Script | What it does |
| --- | --- |
| `npm run dev` | development server |
| `npm run build` / `npm start` | production build / server (build snapshots the DB first) |
| `npm run db:seed` | migrations + first admin + import of the original projects (safe to re-run) |
| `npm run db:migrate` | apply migrations only |
| `npm run db:repair` | checks the database; if it can't be read, keeps it aside and restores the newest working backup. Also runs automatically before every start, and converts the old `.data/pglite` folder format once. Same as `REPAIR-DATABASE.bat`. |
| `npm run db:generate` | after editing `lib/cms/db/schema.ts`, create a new SQL migration |
| `npm run typecheck` | TypeScript check |

---

## Using the dashboard (`/admin`)

| Section | What you manage |
| --- | --- |
| **Projects** | the 3D carousel + case studies. Order in the list = order on the arc (↑ ↓). Cover = 3D card, hero = case-study header, sections with Markdown + image/video, links, tags, tools, SEO. |
| **Journal** | blog posts in Markdown with live preview, cover, tags, category, scheduled publishing. |
| **Testimonials / Achievements** | modular sections → shown on `/about` and in the API. |
| **Media** | drag-and-drop uploads; images become optimised WebP + a small preview; alt text; usage-aware delete. |
| **Categories & tags** | organisation (tags are created automatically as you type them). |
| **Settings & theme** | site title/description/URL, your profile (powers the profile portal + `/about`), colours, fonts, reading layout, grid glow, cursor wake, card corners. |
| **Users** | add people with a role; reset passwords. |

**Image sections** (each case-study section, `lib/gallery.ts`): add any number of
images/videos and pick a **layout** — Auto, Full width, Rows (uncropped,
equal height), Grid (even tiles, 1–4 columns), Collage (editorial big/small
tiles, least cropping), Carousel (swipe/drag strip) — and where the **text**
goes — Above, Left/Right (sticky column), Over image, Inside the layout. Auto
decides from the number and shapes of the images and the length of the text;
★ puts an image in a collage's hero tile. The dashboard shows a live
desktop/phone preview made by the same code as the site. Layouts are planned
once on the server and drawn with plain CSS (no layout shift, right-sized
images, lazy loading); phones get a simplified 2-column version.

**Card sections**: switch a section's content from *Images* to *Cards* for
numbered steps (title, text, tag chip such as "Research → Cultural foundation").
Vertical = a timeline joined by a connector line; Horizontal = a row whose
numbers are joined by a line (phones stack them). Auto picks horizontal for 2–4
short cards (`lib/cards.ts`).

**Section composition** (`lib/section-design.ts`): one-click presets — Classic,
Statement, Split, Split reversed, Sticky story, Spotlight, Caption, Tile — plus
fine-tuning: text placement (above / below / left / right / over image / inside),
column split, vertical alignment (top / centre / sticky), text alignment, width
(contained / wide / full-bleed), spacing, overlay position and style, and phone
order. Every option has Auto, decided from the content: e.g. text over an image
reads the image's brightness under the text (stored at upload in
`media.variants.tone`, measured on demand for older files) and picks white text
on a scrim of matching strength, or dark text on a light panel.

**Publishing**: only `published` items are public. Saving updates the live site
immediately (the cached pages for exactly that content are refreshed).
Changing a slug automatically keeps a permanent redirect from the old URL.

### Roles

| | Admin | Editor | Author |
| --- | :---: | :---: | :---: |
| Write drafts | ✓ | ✓ | ✓ |
| Edit others' content | ✓ | ✓ | – |
| Publish / unpublish / reorder | ✓ | ✓ | – |
| Delete content | ✓ | ✓ | own drafts |
| Media upload / delete | ✓ / ✓ | ✓ / ✓ | ✓ / – |
| Categories & tags | ✓ | ✓ | – |
| Site settings & theme | ✓ | read-only | – |
| Users | ✓ | – | – |

---

## Adding a new section type (e.g. "Talks")

Open `lib/cms/collections.ts` and add an entry:

```ts
talks: {
  label: "Talks", singular: "Talk", titleField: "title",
  description: "Conference talks and guest lectures.",
  showOnAbout: true, display: "list",
  fields: [
    { name: "title", label: "Title", type: "text", required: true },
    { name: "issuer", label: "Event", type: "text" },
    { name: "date", label: "Date", type: "date" },
    { name: "url", label: "Recording", type: "url" },
  ],
},
```

That's all: the dashboard menu, list, edit form, validation, the
`/api/v1/collections/talks` endpoint and an `/about` section appear
automatically. No database migration — entries live in the generic `entries` table.
Field types: `text`, `textarea`, `url`, `date`, `number`, `media`, `select`, `boolean`.

---

## API

Public, cacheable, CORS-open (published content only):

```
GET /api/v1                         endpoint list
GET /api/v1/projects                published projects (carousel order)
GET /api/v1/projects/{slug}
GET /api/v1/posts?tag=&category=
GET /api/v1/posts/{slug}            incl. rendered HTML
GET /api/v1/collections/{type}      testimonials, achievements, …
GET /api/v1/settings                site, profile, theme
```

Writes need a signed-in session cookie and a same-origin request; permissions
follow the user's role:

```
POST   /api/v1/projects            create
PATCH  /api/v1/projects/{slug}     partial update (only the fields you send change)
DELETE /api/v1/projects/{slug}
POST   /api/v1/posts · PATCH · DELETE   same for posts
POST   /api/v1/media                multipart upload (file, alt)
```

SEO extras: `/sitemap.xml`, `/robots.txt`, `/journal/feed.xml` (RSS), canonical
URLs, Open Graph/Twitter cards, and schema.org JSON-LD (Person, WebSite,
CreativeWork per project, BlogPosting per post, breadcrumbs).

---

## Deploying

**Step-by-step beginner guide (GitHub + Railway + your own domain): open `HOW-TO-USE.html`.**

Short version, for any Node host with a persistent disk:

1. Create a PostgreSQL database and set `DATABASE_URL` (Railway: `${{Postgres.DATABASE_PUBLIC_URL}}` — the public URL, because private networking isn't available during the build).
2. Set `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `ADMIN_NAME`, `SITE_URL=https://your-domain` and `UPLOAD_DIR` (a mounted volume, e.g. `/data/uploads`).
3. Build with `npm run build` and start with `npm start` (Node 20.9+; `PORT` is respected).
   The `prebuild` step runs migrations and, on an empty database, seeds the admin and the projects automatically — safe on every deploy.
4. Point your domain at the host (CNAME / ALIAS) and set the same URL in Admin → Settings → Site.

**Serverless hosts (Vercel etc.)** have no persistent disk: swap the three functions in `lib/cms/storage.ts` for S3 / Cloudflare R2 / Vercel Blob first.

## Limits — what this does and doesn't do (yet)

Works now: everything in the tables above, tested end to end — login, roles,
CRUD for every content type, uploads, reordering, theme changes, slug
redirects, cache refresh in production mode, the API, sitemap/RSS/JSON-LD.

Not included (possible next steps):

- **Full-page draft preview** — drafts can be previewed per field (Markdown
  preview) but not rendered inside the 3D site before publishing.
- **Revision history / undo** — saves overwrite; no version list.
- **Drag-and-drop reordering** — ordering uses ↑ ↓ buttons.
- **Rich-text (WYSIWYG) editor** — text is Markdown.
- **Password reset by email / invitations** — no email sending is set up;
  admins set temporary passwords.
- **Two-factor auth, API tokens for scripts** — sessions only.
- **Login rate limiting is per server process** — use Redis/Upstash if you run
  several instances.
- **Image focal point / cropping, video transcoding** — images are resized,
  videos stored as uploaded (MP4/WebM).
- **Multi-language content.**
- Text marked `DRAFT —` in the seeded projects was written from titles and tags
  only; years/roles for projects 02–05 are guesses. Edit them in the dashboard.

---

## Architecture

```
app/
  layout.tsx                 html/body, theme fonts + CSS variables from Settings
  (site)/…                   public site: 3D shell, /projects/[slug], /journal, /about
  admin/…                    dashboard (login, (dash)/… pages, actions.ts)
  api/v1/…                   REST API
  uploads/[file]/route.ts    serves uploaded media with immutable caching
  sitemap.ts · robots.ts
lib/cms/
  db/schema.ts               tables (users, sessions, projects, posts, media,
                             categories, tags, entries, settings, redirects)
  db/client.ts               PGlite (local) / node-postgres (DATABASE_URL)
  auth/                      scrypt passwords, DB sessions, RBAC, rate limit
  services/                  all writes: validation + permissions + slugs
  queries.ts                 all public reads, cached and tag-invalidated
  collections.ts             modular section definitions
  settings-schema.ts         site / profile / theme settings + defaults
  markdown.ts · seo.ts · storage.ts · api.ts · revalidate.ts
components/                  3D world (unchanged) + admin/ UI kit and forms
drizzle/                     SQL migrations
scripts/                     migrate, seed, build snapshot
data/seed-projects.ts        original content, used only by the seed
```

Security notes: passwords hashed with scrypt; session tokens are random and
stored hashed; cookies are httpOnly + SameSite=Lax (+ Secure in production);
server actions and API writes are origin-checked (CSRF); every write re-checks
the user's role on the server; Markdown is rendered with raw HTML escaped and
unsafe link schemes removed; SVG uploads are rejected; uploaded filenames are
random and path-traversal safe; `/admin` is noindex and frame-denied.
