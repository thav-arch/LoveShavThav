# Architecture (as implemented, baseline `947d14a`)

> Audited 10 Oct 2026 by reading the code. ~19,560 lines of TS/TSX/CSS in `app/ components/ lib/ scripts/`.

## 1. One Next.js app, two faces

```
Browser ──► Next.js 16 (App Router, React 19, Turbopack dev) ──► Drizzle ORM ──► PGlite (local file)
              │                                                              └► PostgreSQL (DATABASE_URL)
              ├─ public site  app/(site)/…   (3D shell + editorial pages)
              ├─ dashboard    app/admin/…    (server actions)
              ├─ REST API     app/api/v1/…   (route handlers)
              └─ media        app/uploads/[file]/route.ts  ◄── storage/uploads (UPLOAD_DIR)
```

## 2. Routes

| Route | File | Notes |
|---|---|---|
| `/` | `app/(site)/page.tsx` | sr-only project list; the world comes from the layout |
| `/projects/[slug]` | `app/(site)/projects/[slug]/page.tsx` | `generateStaticParams`; checks `redirects` table; renders `ProjectCaseStudy` |
| `/journal`, `/journal/[slug]`, `/journal/feed.xml` | `app/(site)/journal/…` | posts + RSS; slug redirects |
| `/about` | `app/(site)/about/page.tsx` | profile + collections (testimonials, achievements) |
| `/admin/*` | `app/admin/…` | login, dashboard overview, projects, posts, collections, media, taxonomy, settings, users, account |
| `/api/v1/*` | `app/api/v1/…` | projects, posts, collections, settings (GET public); POST/PATCH/DELETE with session |
| `/uploads/[file]` | `app/uploads/[file]/route.ts` | serves uploads, immutable cache, byte ranges (video/audio seeking) |
| `/sitemap.xml`, `/robots.txt` | `app/sitemap.ts`, `app/robots.ts` | |

No `middleware.ts`/`proxy.ts`; redirects are resolved inside the page handlers.

## 3. Public site rendering

- `app/layout.tsx` (server): loads fonts, reads Settings → Theme and writes CSS variables on `<html>`,
  builds metadata from Settings → Site.
- `app/(site)/layout.tsx` (server): loads published projects, profile, theme, music settings; renders
  the client **`PortfolioShell`** (persistent across routes) + **`MusicPlayer`**.
- `PortfolioShell` holds: `PortfolioScene` (R3F canvas: `ProjectWorld` → `GridFloor`, `ProjectCarousel`
  → `ProjectCard`s, `ProfilePortal`), `ProjectIndex` (Full view), `ProfileContent`, `Navigation`,
  `ProjectTransition` overlay, `CustomCursor`, `FilmLoader` (first visit on `/` only).
- Route pages render DOM on top: `ProjectCaseStudy` (sections or a story template),
  `EditorialPage` (journal/about).
- **State:** `lib/store.ts` (zustand; low-frequency: mode WORLD/PROFILE/PLAYGROUND/INDEX/PROJECT/PAGE,
  active index, transition) + `lib/motion.ts` (a plain mutable object written every frame, tweened by
  GSAP — deliberately not React state). `lib/transitions.ts` orchestrates every mode change so the
  WebGL scene and DOM move together.
- **Per-frame loops:** 5 R3F `useFrame` callbacks (scene composite, world/camera, carousel, grid,
  portal) inside one canvas loop; separate rAF loops in FilmLoader (load only), ProjectIndex (Full
  view only), useEditorialScroll (Lenis), plus a scroll-driven rAF in SongsOfSaaja and MusicPlayer
  timers. GSAP's ticker drives tweens.
- **Rendering pipeline** (`PortfolioScene`): manual render pass; when the cursor wake is alive, the
  frame renders into an MSAA target and is composited through the flow shader; while the portal is
  visible the scene is also rendered at half resolution for refraction (`lib/sceneTarget.ts`).
- **Shaders:** `components/shaders/{card,flow,grid,portal}.ts` (GLSL strings).
- **Textures:** `lib/textures.ts` — small preview first (`thumbnailSmall`), full image when idle,
  `createImageBitmap` off-thread, generated fallback for missing files.

## 4. Case-study engine

- Data: `projects.sections` (JSON) — kinds `media | cards | table | board | divider`, plus legacy
  sections with no `kind`.
- Planning: `lib/gallery.ts` (image layouts, planned on the server), `lib/cards.ts`, `lib/blocks.ts`,
  `lib/section-design.ts` (presets + per-section design), `lib/project-theme.ts` (per-project theme,
  page template, music).
- Rendering: `components/ProjectCaseStudy.tsx` → `Gallery`, `Cards`, `Blocks`; bespoke templates in
  `components/stories/` (only `SongsOfSaaja` — chosen by `theme.template = "songs-of-saaja"`).
- Dashboard editor: `components/admin/SectionEditor.tsx` (931 lines) with live previews using the same
  planning code; `ThemePanel.tsx`, `MusicFields.tsx`.

## 5. CMS layers

| Layer | Files | Role |
|---|---|---|
| Schema | `lib/cms/db/schema.ts`, `drizzle/*.sql` | tables (see DATA_AND_CONTENT.md) |
| DB client | `lib/cms/db/client.ts`, `lib/cms/db/index.ts` | PGlite-in-memory + atomic file save / node-postgres; lock file; startup backup; auto-migrate on module load (local) |
| Validation | `lib/cms/validation.ts`, `settings-schema.ts`, `collections.ts`, `lib/music.ts` | zod schemas |
| Writes | `lib/cms/services/*.ts`, `app/admin/actions.ts` | permission checks + validation + slugs + redirects |
| Reads | `lib/cms/queries.ts` | `unstable_cache` with tags `cms:projects/posts/entries/settings/taxonomy/redirects`; posts also refresh hourly (scheduled posts appear within ≤ 1 h) |
| Invalidation | `lib/cms/revalidate.ts` | `updateTag` from actions, `revalidateTag` from API |
| Auth | `lib/cms/auth/{password,session,rbac,rate-limit}.ts` | scrypt hashes; random session token stored as SHA-256; `cms_session` cookie httpOnly + SameSite=Lax (+Secure in prod), 30-day TTL; roles admin/editor/author; login limited to 8 attempts / 15 min per IP+email (in-memory, per process) |
| API | `lib/cms/api.ts`, `app/api/v1/*` | public GET (CORS-open, published only); writes need session + same origin |
| Media | `lib/cms/services/media.ts`, `lib/cms/storage.ts`, `lib/cms/tone.ts` | images → WebP 2560 px + 480 px preview + brightness map (sharp); MP4/WebM; MP3/M4A/OGG/WAV; SVG refused; content-sniffed; random names; path-traversal safe |
| Markdown | `lib/cms/markdown.ts` | marked, raw HTML escaped, unsafe links removed, `==hl==` / `^^hl2^^` |
| SEO | `lib/cms/seo.ts`, `components/JsonLd.tsx`, sitemap/robots/RSS | |

## 6. Local database file mechanics (`lib/cms/db/client.ts`)

- Dev server: loads `.data/db.tar.gz` into memory, saves the whole DB atomically (temp file + rename)
  ≤ 1.5 s after a change and on shutdown; copies a backup into `.data/backups` on start (keeps 10);
  `.data/db.lock` holds the owner PID.
- Next.js helper/worker processes get a private read-only copy (never save).
- `next build`: workers load `.data/pglite-snapshot.tar.gz` written by `scripts/db-snapshot.ts` (prebuild).
- `scripts/db-file.mjs` (runs before dev/start/db scripts): converts the old `.data/pglite` folder
  format, checks the file is readable, restores the newest working backup if not.

## 7. Dependencies (runtime vs tooling)

| Package | Runtime? | Used for | Where |
|---|---|---|---|
| next 16, react 19, react-dom | yes | framework | everywhere |
| three, @react-three/fiber | yes (client) | 3D world | 10 / 5 files (scene, world, carousel, card, grid, portal) |
| gsap | yes (client) | timelines/tweens (loader, transitions, index, editorial fade) | 4 files |
| lenis | yes (client) | smooth scroll on editorial pages | 1 file |
| zustand | yes (client) | low-frequency UI state | `lib/store.ts` |
| zod | yes (server + admin client) | validation | 6 files |
| marked | yes (server) | Markdown | `lib/cms/markdown.ts` |
| drizzle-orm | yes (server) | queries | 19 files |
| @electric-sql/pglite | yes (local server) | embedded Postgres | DB client, db-file script |
| pg | yes (production server) | PostgreSQL driver | DB client |
| server-only | build guard | prevents server modules in client bundles | side-effect imports |
| **sharp** | yes (server) | image conversion, brightness maps | `services/media.ts`, `tone.ts` — **not declared in package.json** (comes in transitively via next) |
| drizzle-kit, tsx, typescript, @types/* | dev only | migrations, scripts, types | |

No ESLint config, no test framework, no CI. `@react-three/drei` and other helper libraries are not used.

## 8. Build & run

- `npm ci` → `npm run dev` (port 3000). `.claude/launch.json` defines the same for the preview pane.
- Type check: `npx next typegen && npx tsc --noEmit` (passes at baseline). `npm run typecheck` alone
  fails on a fresh checkout (missing generated route types).
- Production build not yet run in this folder (prebuild writes a DB snapshot into `.data/`; do it in
  Stage 2 with the dev server stopped).

## 9. Deployment (not live)

Designed for a Node host with a persistent disk (README / HOW-TO-USE.html: GitHub + Railway):
PostgreSQL via `DATABASE_URL`, uploads on a mounted volume via `UPLOAD_DIR`, env `ADMIN_*`,
`SITE_URL`. Settings → Site URL is still `http://localhost:3000`. Serverless hosts would need
`lib/cms/storage.ts` moved to object storage.
