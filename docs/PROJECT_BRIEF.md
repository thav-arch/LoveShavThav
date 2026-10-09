# Project brief

> Status: written during the Stage 1 audit (10 Oct 2026). Items marked **TO CONFIRM** are the
> owner's to decide; nothing here was invented to fill gaps.

## Purpose

A personal portfolio for **Thavanesh Nagarajan**, presenting game-design and UI/UX work as an
interactive experience rather than a document, with a built-in dashboard (`/admin`) so content can be
edited without touching code.

Profile as stored in the CMS today (Settings → Profile):
- Roles: Game Designer · Experience Designer · Interaction Designer
- Education: Digital Game Design, National Institute of Design, Bengaluru, India
- Skills: Game Design, System Design, Narrative Design, Level Design, UI / UX, Interaction Design,
  Prototyping, Unity, Unreal Engine, Blender, Figma
- Links: Instagram, YouTube
- Intro: "I design games, systems and interactive experiences at the intersection of gameplay,
  narrative, interaction and visual design." — followed by what looks like test text
  ("GAMES have interactionnssssss."). **TO CONFIRM / fix in the dashboard.**

## Audience — TO CONFIRM

Not stated anywhere in the code or content. Likely studios / recruiters / collaborators in games and
UX, but the owner should confirm (it affects tone, SEO and what to optimise first).

## Content today (from the database, 10 Oct 2026)

| # on strip | Project | Category | Page type | Notes |
|---|---|---|---|---|
| 1 | Songs of Saaja — Narrative 3D Adventure (2026) | Games | Hand-built from Figma | own music track; formerly "Whispers of Mahua" |
| 2 | Dabba Rush — 2D physics side-scroller (2025) | Games | Sections (6) | renamed from "Dabba Wala" |
| 3 | The Umbrella Man — concept game trailer (2025) | Games | Sections (5) | has video |
| 4 | Elevator Empire — F2P experimental game (2025) | Games | Sections (6) | has video |
| 5 | Farmville 2 — Country Escape, live-ops events (2026) | Live Ops | Sections (0) | case study empty |
| 6 | Dashboards and UI (2024–2025) | UI UX Designer | Sections (0) | **no cover image → broken card thumbnail** |
| 7 | PowerUI Library (2024) | UI UX Designer | Sections (0) | **no cover image → broken card thumbnail** |

Journal: 1 post, still a draft. About: 2 published achievements, 1 draft testimonial.

## Visual identity (summary — details in DESIGN_SYSTEM.md)

- Home: a dark, cinematic 3D "film strip" over rollers, pastel glowing grid floor, liquid cursor
  wake, projector-style loader. Film / projector is the organising metaphor.
- Case studies: light editorial pages (paper #f1f0ec, ink #0b0b0b) layered over the paused 3D world;
  projects can carry their own world (e.g. Songs of Saaja: dark earth, cream bands, clay and gold,
  Marcellus SC, Gond-art motifs).
- Calm, deliberate motion (long expo/power eases, critically-damped springs, no camera roll).

## Major features

3D film-strip home (drag / wheel / keys), Featured / Full views, liquid chrome Profile & Playground
portal, project open/close transitions, configurable section-based case studies, a bespoke
Figma-built page, Journal + RSS, About with testimonials/achievements, site-wide background music,
dashboard with roles, media library, SEO (sitemap, JSON-LD, share cards), slug redirects.

## Goals (from the owner's rebuild brief)

- Keep the creative experience; make the system behind it simpler, more reliable, faster and easier
  to extend.
- Keep producing new project pages from Figma links, screenshots and research, reusing the
  foundation without forcing one template (candidates named: Songs of Saaja, Dabba, Elevator Empire).
- Not yet online — deployment target **TO CONFIRM** (README / HOW-TO-USE describe GitHub + Railway).
