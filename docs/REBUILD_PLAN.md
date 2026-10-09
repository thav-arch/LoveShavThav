# Rebuild plan & audit report

> **Current stage: 1 — Audit complete (10 Oct 2026). Waiting for the owner's approval before Stage 2.**
> No application code, database, uploads or configuration has been changed.

## Work log

| Date | Step | Result |
|---|---|---|
| 10 Oct | Found `PortfolioWebNew` empty; reported instead of switching folders | owner authorised a copy |
| 10 Oct | Copied the latest working copy (code 6 Oct, DB 6 Oct, 65 uploads, `.env.local`), excluding `node_modules`/`.next` | 3,399 files, **0 mismatches** (SHA-256 verified) |
| 10 Oct | `git init` + baseline commit `947d14a` on `master` | 210 files tracked; `.data/`, `storage/`, `.env.local` ignored; no secrets in tracked files |
| 10 Oct | `npm ci` (lockfile-exact, no tracked changes) | 86 packages |
| 10 Oct | `npx next typegen && npx tsc --noEmit` | passes (plain `npm run typecheck` fails until types are generated) |
| 10 Oct | Read-only database inventory + file-reference check | 7 projects, 68 media, 3 redirects; every referenced file present |
| 10 Oct | Wrote CLAUDE.md and docs/* | this documentation set |

## 1. What the application actually contains

See ARCHITECTURE.md, DATA_AND_CONTENT.md, INTERACTIONS.md. In short: one Next.js 16 app (public 3D
portfolio + editorial pages + `/admin` CMS + REST API) on Drizzle/PGlite, ~19.6k lines, 14 runtime
dependencies, no lint/test/CI, not deployed.

## 2. Discrepancies found (supplied overview / README vs code)

| # | Claim | Reality |
|---|---|---|
| D1 | Overview: `Desktop\portfolio` is the copy you update | It has the latest **code** but an old-format **database from 2 Oct and no uploads** — it is not a usable copy of your content. |
| D2 | README describes the CMS | Missing: music, audio uploads, per-project themes/page templates, card/table/board/divider sections, the Songs of Saaja story page. |
| D3 | README architecture: "components/ 3D world (unchanged)" | Outdated wording; components also hold the case-study engine and story page. |
| D4 | `ProjectCarousel.tsx` header: "HTML labels layered over the cards" | Labels are drawn into the card texture now (`lib/card-label.ts`). Stale comment. |
| D5 | `npm run typecheck` | Fails on a fresh checkout (route types not generated). |
| D6 | Scheduled publishing | Works, but a scheduled post can take up to 1 hour to appear (hourly cache refresh). |
| D7 | `data/seed-projects.ts` = "original content" | Outdated: the database has renamed/added projects (dabba-rush, songs-of-saaja, dashboards-and-ui, powerui-library). |
| D8 | `sharp` | Used directly by the media pipeline but not listed in `package.json`. |
| D9 | `UPDATE-MY-DESKTOP-COPY.bat` | Would copy this folder over `Desktop\portfolio` — conflicts with the new source-of-truth rule. Do not run. |

## 3. Must be preserved

Everything in INTERACTIONS.md (homepage strip, loader, grid, wake, portal, Full view, transitions,
case-study reveals/parallax, Songs of Saaja's 17 interactions, music); the section-based case studies
in live use; the Songs of Saaja page as a bespoke page; the dashboard workflow (projects, media,
settings/theme, music, journal, about collections) with authentication; all slugs + 3 redirects; all
content, uploads and backups; SEO outputs; reduced-motion and keyboard support.

## 4. What looks unnecessarily complex (with evidence)

| Area | Evidence | Note |
|---|---|---|
| Section design engine | `SectionEditor.tsx` 931 lines + `section-design.ts`, `gallery.ts` (342), `cards.ts`, `blocks.ts`, `Blocks.tsx`, presets × fine-tune options. **Rendered pages use only image sections (auto/top) and one vertical card list.** Advanced options are used only by 17 hidden Whispers-of-Mahua sections. | Biggest simplification opportunity — but which capabilities to keep for future projects is the owner's decision. |
| Dead content | Songs of Saaja stores 17 sections it never renders. | Can be archived after backup. |
| CSS | `globals.css` 2,563 lines; ~10 different breakpoints (600–1023 px) vs 3D layout's 700/1100. | Consolidate with visual regression checks. |
| Duplicated story widgets | `BeatTable`, `MapSpots`, `Draw`, `Stem` live inside `SongsOfSaaja.tsx`. | Extract when a second story page needs them. |
| Local DB machinery | in-memory PGlite + atomic autosave + lock + helper-process copies + build snapshot + repair script + auto-migrate. | Complex, but each part fixes a real failure seen earlier (corruption, double-open). Replace only with a clearly simpler, equally safe option. |
| CMS breadth vs use | 1 user, 1 draft post, 3 collection entries; roles, multi-user, API writes, RSS, scheduling barely used. | Keep auth regardless; trimming features is an owner decision. |

Not complex: the dependency list (14 runtime packages, no UI kits, no drei) and the 3D code
(~2,250 lines across scene, carousel, cards, grid, portal, shaders, track, layout, motion, textures) are proportionate to what they do.

## 5. Dependencies

Justified: next, react, three, @react-three/fiber, gsap, lenis, zustand, zod, marked, drizzle-orm,
@electric-sql/pglite (local), pg (production), server-only. Needs action: **declare `sharp`**.
Dev-only: drizzle-kit, tsx, typescript, @types/*. Deprecated transitive warnings (`@esbuild-kit/*`
via drizzle-kit) — harmless, revisit when upgrading drizzle-kit.

## 6. Safe simplifications (low risk, reversible via Git)

1. Fix `typecheck` script (`next typegen && tsc --noEmit`); add `.gitattributes` for line endings.
2. Declare `sharp` in `package.json`.
3. Fix stale comments (D4) and update README (D2/D3).
4. Retire `UPDATE-MY-DESKTOP-COPY.bat` (Git replaces it) — needs approval.
5. Add a minimal regression harness (ESLint + a Playwright smoke script that loads every route and
   screenshots the INTERACTIONS checkpoints) — gives the rebuild a measurable baseline.
6. Content fixes via dashboard (owner): covers for 2 projects, profile intro text, site URL before launch.

## 7. Changes that carry significant risk

- Replacing the database layer (PGlite → SQLite/Postgres-everywhere/headless CMS) — data migration,
  dashboard rewrite, deployment change.
- Removing or replacing the dashboard (Markdown files / external CMS) — changes the editing workflow.
- Changing the section JSON shape or removing section kinds — needs a data migration + rollback.
- Static export of the public site — loses instant publishing, redirects table and server media.
- Rewriting the 3D scene or transitions — high regression risk for the signature experience.
- Folding Songs of Saaja into the generic engine — loses its precise composition (not recommended).

## 8. Needs testing or information

- **Stage 2 baseline:** run the site here, walk INTERACTIONS.md, screenshots at 1440/768/375, reduced
  motion; first production build (stop dev server first; it writes `.data/pglite-snapshot.tar.gz`).
- **Measure (none taken yet):** production bundle sizes, first-load time with the film loader,
  GPU/FPS on a mid-range laptop and phone, image weight per page.
- **Owner decisions:** audience; keep Journal / testimonials / multi-user roles / API writes?;
  which section features to keep for future projects; deployment target and timing; whether old
  `.data/pglite-*` folders can be archived; whether to bring over the Figma source exports.

## 9. Architecture options (recommendation: A)

| Option | Benefit | Cost / risk |
|---|---|---|
| **A. Keep the stack, simplify inside** (prune unused engine options, consolidate CSS, extract shared story widgets, harden scripts) | Preserves every feature and URL; smallest risk; incremental | Codebase shrinks moderately, not dramatically |
| B. Split: static public site + separate CMS | Cheap static hosting | Two systems; publishing needs rebuilds; redirects/media rework |
| C. External headless CMS (e.g. Payload/Sanity) | Off-the-shelf editing | Migration of content + media; new service, cost; custom fields re-modelled |
| D. Markdown/JSON in Git, no dashboard | Smallest system | Loses the dashboard, uploads UI, music/theme settings UI |

## 10. Recommended sequence

1. **Stage 2 — Baseline** (needs approval): run, capture, build, measure; add the smoke harness (6.5).
2. **Owner decisions** on §8 list.
3. **Stage 4 increments**, each its own commit with before/after screenshots:
   a. hygiene (6.1–6.3) → b. content fixes (owner) → c. CSS breakpoint consolidation →
   d. section-engine pruning per decisions, with a backed-up, reversible data migration (incl.
   archiving Saaja's hidden sections) → e. extract shared story widgets → f. deployment prep.
4. **Stage 5 — Verification** against the baseline screenshots and INTERACTIONS.md.
5. **Stage 6 — Docs** updated with what changed, what was measured, what remains unverified.
