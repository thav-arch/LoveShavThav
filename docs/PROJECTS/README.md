# Project pages — how to brief and build one

One folder or file per project: `docs/PROJECTS/<slug>.md` (copy `_TEMPLATE.md`). Put large reference
material (Figma exports, research PDFs, screenshots) in `docs/PROJECTS/<slug>/` — keep raw exports
out of `public/`; only web-optimised assets go there.

## Two ways a project page can be built

| | Section-based (dashboard) | Bespoke "story" page (code) |
|---|---|---|
| Edited in | Dashboard → Projects → sections | `components/stories/<Name>.tsx` + `.css` |
| Good for | standard case studies, quick updates | Figma compositions needing exact placement or unique animation |
| Selected by | Project → Case-study look → Page = "Built from the sections below" | Page = the story template (registered in `lib/project-theme.ts` `PAGE_TEMPLATES` and `components/ProjectCaseStudy.tsx`) |
| Text editable in dashboard | all | title, statement, role, year, disciplines, tools, video only |
| Example | Dabba Rush, Elevator Empire | Songs of Saaja |

Reuse the foundation in both: CSS tokens, the 1440-unit grid (`--u`), `useEditorialScroll` reveals /
parallax / progress, `BeatTable` + `MapSpots` (currently inside SongsOfSaaja.tsx — candidates to
extract), Marcellus/Inter type, music and video slots.

## Workflow (what Claude does when given a project)

1. Read `CLAUDE.md`, this file and `docs/PROJECTS/<slug>.md`. Only work on the named project.
2. Inspect the Figma frame (file key + node id), list layers, text styles and assets; screenshot it.
3. Decide section-based vs bespoke **with the owner**, citing what the design needs.
4. Export assets at 2× → WebP/SVG, record sizes; never upscale beyond the source.
5. Build: exact positions on desktop, readable single column below 1024 px, reduced-motion fallbacks.
6. Add interactions/animations requested in the brief; record each in `docs/INTERACTIONS.md`.
7. Verify against the Figma render at several scroll positions, desktop 1440 + tablet + phone 375,
   and a position check of placed elements; check console/network for errors.
8. Update `docs/PROJECTS/<slug>.md` (what was built, deviations from Figma, open questions).

## Rules

- Never invent research, metrics, dates or quotes — leave **TO CONFIRM**.
- Keep Figma wording exactly (flag apparent typos to the owner rather than silently fixing them).
- Placeholder notes inside Figma ("PLACEHOLDER FOR CMS…") are instructions, not page copy.
