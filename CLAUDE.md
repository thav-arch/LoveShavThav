# CLAUDE.md — permanent rules for this project

Portfolio + CMS for **Thavanesh Nagarajan** (game / experience designer).
Next.js 16 · React 19 · React Three Fiber · GSAP · Lenis · Drizzle · PGlite (local) / PostgreSQL (production).

**Source of truth: `C:\Users\roxst\Desktop\PortfolioWebNew`** (this folder). Every other portfolio copy
(`Desktop\portfolio`, `Desktop\WebsitePortfolio`, the "Portfolio (latest from Claude)" shortcut) is out of
scope: never read from them to fill gaps, never write to them, never sync them.

Start every session by reading, in order: this file → `docs/REBUILD_PLAN.md` (current status) →
whichever of `docs/ARCHITECTURE.md`, `docs/INTERACTIONS.md`, `docs/DESIGN_SYSTEM.md`,
`docs/DATA_AND_CONTENT.md`, `docs/PROJECTS/` the task touches.

## 1. Data safety (non-negotiable)

- **Never delete, reset, overwrite or "clean up"** `.data/` (database + backups), `storage/uploads/`,
  `.env.local`, `drizzle/` (migration history) or `public/projects/`.
- The database is `.data/db.tar.gz` (PGlite, saved ~2 s after each change). Back it up before any
  schema change, migration, import or bulk edit: copy it to `.data/backups/<reason>-<date>.tar.gz`.
- Only one process may open the database (lock file `.data/db.lock`). Stop the dev server before
  `npm run build`, `db:*` scripts or any script that opens the database.
- Read the database without touching it by loading a copy in memory:
  `new PGlite({ loadDataDir: new Blob([readFileSync(".data/db.tar.gz")]) })` — never through
  `lib/cms/db/client.ts`, which takes the lock and autosaves.
- Keep project slugs and the `redirects` table intact (e.g. `/projects/wom`, `/projects/gond`,
  `/projects/dabba-wala` all redirect). Changing a slug in the CMS adds a redirect automatically.
- **Do not run `UPDATE-MY-DESKTOP-COPY.bat` from this folder** — it copies this code over
  `Desktop\portfolio`, which is out of scope.

## 2. Secrets

- `.env.local` holds the admin login and site URL. Never print its values, never copy them into
  docs, commits, logs or chat. It is git-ignored — keep it that way (also `.data/`, `storage/`).
- Never weaken authentication, roles (admin / editor / author), CSRF/origin checks, upload
  validation (SVG refused, files sniffed by content) or Markdown sanitising as an "optimisation".

## 3. Visual and behavioural preservation

- The acceptance test is **what a visitor sees and feels**, not a passing build. Keep the 3D film strip,
  film-reel loader, grid floor, cursor wake, chrome portal, transitions, case-study layouts, the
  Songs of Saaja page, music and every interaction listed in `docs/INTERACTIONS.md`.
- Do not swap a sophisticated effect for a plain fade, change timings, or drop a micro-interaction to
  save code. Simplify the *implementation*, not the *experience*. If an effect is too costly, find the
  measured bottleneck and propose the smallest fix first.
- Do not turn the homepage into a grid, or force custom Figma pages into the generic section engine.
- Respect `prefers-reduced-motion`, keyboard (arrows / Enter / Esc) and touch input everywhere.
- Before removing any feature, setting or dashboard capability: document it in
  `docs/REBUILD_PLAN.md` with evidence that it is unused, and get the owner's approval.

## 4. How to work

- Work in small, reviewable steps; commit each logical step (Git is initialised; baseline commit
  `947d14a`). Never `git reset --hard`, force-push or rewrite history without explicit approval.
- Approval gates: no refactor, migration, dependency change or deletion without the owner's go-ahead
  on the plan in `docs/REBUILD_PLAN.md`.
- Do not invent content, research, metrics or measurements. Mark unknowns as **UNKNOWN / TO CONFIRM**.
- Update the relevant doc in `docs/` in the same change as the code (interactions, data, architecture).

## 5. Checks before saying "done"

1. `npx next typegen && npx tsc --noEmit` — passes (note: plain `npm run typecheck` fails on a fresh
   checkout until `next typegen`/`dev`/`build` has generated route types).
2. Run the site (`npm run dev`, http://localhost:3000, dashboard `/admin`) and verify in a browser:
   homepage strip (drag / wheel / keys / click), Full view, Profile & Playground portal, opening and
   closing a project, prev/next, a section-based case study, Songs of Saaja, Journal, About, music.
3. Check desktop (1440), tablet (768) and phone (375) widths, and reduced motion.
4. No lint or test suite exists yet — say so instead of claiming they pass.
5. Report exactly what was tested and what was not.

## 6. Commands

| | |
|---|---|
| `npm ci` | install exact dependencies (node_modules is not in Git) |
| `npm run dev` | dev server — runs `db-file.mjs` first (repairs / converts the DB file if needed) |
| `npm run build` / `npm start` | production; `prebuild` writes `.data/pglite-snapshot.tar.gz` |
| `npm run db:seed` / `db:migrate` / `db:repair` / `db:generate` | see README.md |
| `START-WEBSITE.bat` / `REPAIR-DATABASE.bat` | the owner's double-click tools |

## 7. Building new project pages

Follow `docs/PROJECTS/README.md`. Reuse the shared foundation (grid units, reveal/scroll hooks,
beat tables, map hotspots, typography tokens); build bespoke layout only where the Figma design needs
it. Only work on the project the owner names. Never invent project details.
