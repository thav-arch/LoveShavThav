# Songs of Saaja (`songs-of-saaja`)

Narrative 3D adventure (2026) — Game / Narrative / Level / Environment Designer; Unreal Engine 5.8.2,
Claude Code, Blender. Formerly "Whispers of Mahua" (old URL `/projects/wom`, and `/projects/gond`,
redirect here).

## References
- Figma file `M674NkKpSSNUTXthRrDFUb` (DesignContest):
  - **current frame `89:20318` "Songs of Saaja", 1440 × 14275** (built 6 Oct 2026)
  - previous frame `67:1043` (1440 × 11576), earlier "Whispers of Mahua" frame `56:25`
- The 2× renders and raw exports used to build it were kept in the previous working copy's session
  folder (not copied here). They can be re-exported from Figma, or copied in with the owner's approval.

## Implementation (baseline `947d14a`)
- `components/stories/SongsOfSaaja.tsx` (1,076 lines) + `SongsOfSaaja.css` (1,176 lines).
- Selected by the project's theme: `template: "songs-of-saaja"` (Dashboard → Case-study look → Page).
- Desktop ≥ 1024 px: every element positioned at its Figma coordinates on a 1440-unit grid
  (`--u = 100cqw / 1440`); sections are stacked blocks whose heights sum to 14275. Below 1024 px:
  the same elements flow into one column (decorations hidden, maps/tables scroll sideways).
- From the dashboard: title, statement (`summary`, uses `==…==` highlight), role, year, disciplines
  (tags minus tools), tools, video URL (gameplay slot), music. Everything else is in the code.
- Assets: `public/projects/saaja-story/` (WebP/SVG, ≈ 2.3 MB): keyart, band, strip (source only
  1920 px wide, shown 4171 units wide — a higher-resolution source would sharpen it), environment +
  env-frame, maps, collages, terrain, assets, rocks, suns, glyphs, feet sprite, journey.
- Stored but unused: the project's 17 database sections (old Whispers of Mahua content).

## Interactions
See `docs/INTERACTIONS.md` §F (S1–S17).

## Deviations from Figma (deliberate, owner informed 6 Oct)
- Level 2 table: 18 units moved from "Narrative Reveal" to "Progression" so "Unlock cave paths" fits
  (Figma clips it); first column kept on one line so "Animal Encounter 1/2" show their number.
- Added: Bana progression meter, map hotspots (hidden until hover), "Gameplay video coming soon"
  instead of the Figma placeholder note.
- Copy kept as designed, including "Cultural Instrument used for Celebrations and prayers" under
  "Sculptures & Statues" (likely copy-paste in Figma — **TO CONFIRM**).

## Open questions
- Higher-resolution Gond-art strip? · Correct caption for "Sculptures & Statues"? · Gameplay video link?
