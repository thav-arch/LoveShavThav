# Interaction & animation inventory

> Audited 10 Oct 2026 by reading the code in this folder. **Verification column:**
> - **Seen** = observed working in a browser on 4–6 Oct 2026 in the previous working copy, whose code is
>   byte-identical to this folder's baseline commit `947d14a`. Must be re-checked here in Stage 2.
> - **Code** = identified from code only; not yet observed.
> Every row must still behave the same after the rebuild (see CLAUDE.md §3).

## A. Global / shell

| ID | Interaction | Trigger | Expected result | Implementation | Verified |
|---|---|---|---|---|---|
| G1 | Persistent 3D shell | any route change between `/`, `/projects/*`, `/journal`, `/about` | world stays mounted; pages render on top; no reload | `components/PortfolioShell.tsx`, `app/(site)/layout.tsx` | Seen |
| G2 | Escape key | `Esc` | project → close transition; page → go home; portal/index → back to world | `PortfolioShell.tsx` keydown | Code |
| G3 | Native cursor states | hover world / card / drag | grab / pointer / grabbing | `components/CustomCursor.tsx`, `lib/cursor.ts` (`data-cursor` labels) | Code |
| G4 | Reduced motion | OS setting | shorter/no tweens, loader 300 ms, no motes/spin, scroll effects static | `motion.reducedMotion`, CSS `@media (prefers-reduced-motion)` | Code |

## B. First load

| ID | Interaction | Trigger | Expected result | Implementation | Verified |
|---|---|---|---|---|---|
| L1 | Film-reel loader | first visit starting on `/` (deep links skip it) | film strip runs through a gate, counter follows real loading (3D chunk + card previews), min 1.5 s, safety release at 9 s; settles on a frame, collapses to a slit, shutters part | `components/FilmLoader.tsx`, `lib/loading.ts` (GSAP timeline + rAF) | Seen |
| L2 | Reel intro | loader shutters open | strip threads in from the right (pos −4.5 → 0 over 3.2 s, `power2.out`) and settles on frame 01 | `playIntro()` in `lib/transitions.ts` | Seen |
| L3 | Progressive card textures | load | tiny preview first, full texture swapped in when idle; generated fallback if a file is missing | `lib/textures.ts` | Code (fallback path is what hides the 2 missing thumbnails) |

## C. Home — 3D film strip

| ID | Interaction | Trigger | Expected result | Implementation | Verified |
|---|---|---|---|---|---|
| H1 | Scroll the strip | mouse wheel / trackpad | moves by cards; target can lead position by ≤ 1.5 cards; loops forever | `components/ProjectCarousel.tsx` (wheel, passive) | Seen |
| H2 | Drag the strip | pointer drag (> 6 px) | follows pointer; release throws ≤ 2 cards then settles on nearest | `ProjectCarousel.tsx` pointer handlers | Seen |
| H3 | Click a card | click centre card / side card | centre → open project (H8); side → slide it to centre | `pickAtPointer` + `enterProject` | Seen |
| H4 | Keyboard | ← → ↑ ↓, Enter | previous/next card; Enter opens the centred project | `ProjectCarousel.tsx` keydown | Code |
| H5 | Frame bending & settling | movement speed | frames bend/bulge with velocity via critically-damped springs, ripple outward, settle without wobble; gaps open slightly while moving | `lib/motion.ts`, `lib/track.ts`, `components/shaders/card.ts` | Seen |
| H6 | Labels in cards | always | title, subtitle · year, indicator drawn into the card texture; bend with the card; fade with world visibility | `lib/card-label.ts`, `ProjectCard.tsx` | Seen |
| H7 | Hover | pointer over card | slight lift/brighten of hovered frame | card shader `uHover` | Code |
| H8 | Open project | click / Enter | card flies to full screen (1.25 s `expo.inOut`), white wash bridges dark → light, case study rises in (staggered 1.2 s `expo.out`) | `enterProject`, `revealProject` (`lib/transitions.ts`), `ProjectTransition.tsx` | Seen |
| H9 | Grid floor | always | pastel grid slides with the strip, pool of light under cursor, flares with scroll speed, ripples under portal | `components/GridFloor.tsx`, `shaders/grid.ts` | Seen |
| H10 | Liquid cursor wake | cursor movement | short local ripple + slight RGB split; stops rendering ~900 ms after cursor stops | `components/PortfolioScene.tsx`, `shaders/flow.ts` | Seen |
| H11 | Camera parallax | pointer position | small damped parallax, no roll (motion-sickness safe) | `components/ProjectWorld.tsx` | Seen |
| H12 | Position counter | strip moves | "01 / 07" + progress bar update; hidden outside world mode | `components/Navigation.tsx` | Code |
| H13 | Responsive layouts | width/aspect | mobile < 700 px: one dominant frame; tablet < 1100 px or aspect < 1.15: gentler fold; desktop: long zig-zag | `lib/layout.ts` | Code |
| H14 | Tab hidden | visibility change | render loop work paused | `PortfolioScene.tsx` | Code |

## D. Home — views and portal

| ID | Interaction | Trigger | Expected result | Implementation | Verified |
|---|---|---|---|---|---|
| V1 | Featured / Full toggle | bottom-left buttons | Full: strip drops away (world visibility 1.4 s / 0.9 s), titles rise staggered (1.1 s, 0.06 s stagger) | `setMode()`, `components/ProjectIndex.tsx` | Code |
| V2 | Full-list preview | hover a title | tilted preview card trails the pointer with velocity tilt (±14°) | `ProjectIndex.tsx` (rAF) | Code |
| V3 | Full-list open | click a title | preview card expands to full screen (clip-path, 1.05 s) then case study | `enterProject(…, "index")` | Code |
| V4 | Profile / Playground portal | top-right / bottom-right | liquid chrome ring opens in front of camera (1.9 s), refracts the world, droplets orbit; profile/playground text inside | `components/ProfilePortal.tsx`, `ProfileContent.tsx`, `shaders/portal.ts`, `lib/sceneTarget.ts` | Code |

## E. Case studies (all)

| ID | Interaction | Trigger | Expected result | Implementation | Verified |
|---|---|---|---|---|---|
| C1 | Smooth scroll | wheel / touch / keys | Lenis smoothing (lerp 0.11) inside the page's own scroller | `components/useEditorialScroll.ts` | Seen |
| C2 | Reveal on enter | element 12 % visible | fade/slide in (`.in` class) | `useEditorialScroll.ts` (IntersectionObserver) | Seen |
| C3 | Image parallax | scroll | images drift ±~7 % | `[data-parallax]` | Seen |
| C4 | Videos | scroll into / out of view | autoplay muted when visible, pause when not | `video[data-autoplay]` | Code |
| C5 | Prev / Next project | header buttons or bottom links | slide to the neighbouring project (0.45 s) | `switchProject()` | Code |
| C6 | Close project | Close / Esc / name | white wash, card shrinks back into its slot on the strip (1.35 s `expo.out`) | `exitProject()` | Seen (partly; stalled once in a hidden browser pane) |
| C7 | Scroll-drawn elements | scroll | drawn paths, connectors, footprints, stems use `--p` progress; ornaments drift | `useEditorialScroll.ts` (`data-progress`, `data-drift`) | Seen |
| C8 | Image carousel layout | drag (mouse) / swipe | native scroll-snap strip, mouse drag supported | `components/Gallery.tsx` | Code |
| C9 | Card section animations | scroll | path line draws, range dot, timeline | `components/Cards.tsx` | Seen (old WoM sections, now hidden) |

## F. Songs of Saaja (bespoke page) — `components/stories/SongsOfSaaja.tsx`

| ID | Interaction | Trigger | Expected result | Verified |
|---|---|---|---|---|
| S1 | Key-art breathing + drifting light motes | always | 26 s slow scale; 14 warm motes rise | Seen |
| S2 | Pattern band drift | scroll | band shifts slightly | Seen |
| S3 | Stems draw down | scroll | lines draw to their dot/point | Seen |
| S4 | Question lines | enter view | fine rules scale out from centre | Seen |
| S5 | Gond-art strip pan | scroll through it | 4171-unit strip travels 2731 units sideways | Seen |
| S6 | Journey line | scroll | three white path segments draw progressively through Chapters 1–2 | Seen |
| S7 | Forest / cave outlines | enter view | outlines draw themselves (pathLength 1) | Seen (partly) |
| S8 | Dot clusters | scroll | dots appear one by one | Code |
| S9 | Design-process trail | scroll | dashed trail draws (masked), tip ~62 % down the screen; nodes light up with a ping | Seen |
| S10 | Suns / ornaments | always | slow rotation; rocks drift | Seen |
| S11 | Map ↔ beat chart linking | hover/focus a row or hotspot | row highlights (gold bar), matching map spots ring + tooltip; all spots sharing that beat light | Seen |
| S12 | Bana progression meter | Level 2 chart enters view | 4-segment meters fill in row order; gold at "Bana Complete" | Seen (DOM-verified) |
| S13 | Draft 1 → 8 line | scroll | dashed arrow draws left→right; dot glows | Seen |
| S14 | Art-direction connectors | scroll | dashed connectors grow out from the map | Seen |
| S15 | Walking footprints | scroll | 14 footprints appear in sequence along both trails | Seen |
| S16 | Gameplay video slot | project Video field set | YouTube/Vimeo embed or file plays in the 16:9 slot; else "Gameplay video coming soon" | Code (no video set yet) |
| S17 | Phone layout | < 1024 px | one column, decorations hidden, maps/tables scroll sideways | Seen (DOM-verified) |

## G. Music (site-wide) — `components/MusicPlayer.tsx`, `lib/music.ts`

| ID | Interaction | Trigger | Expected result | Verified |
|---|---|---|---|---|
| M1 | Sound toggle | click "Sound on/off" | starts/stops music (sound only after a user gesture) | Seen |
| M2 | Auto-start | first click/key anywhere | if Settings "on first interaction" (live setting) or visitor opted in before | Code |
| M3 | Volume slider | hover / focus (always on touch when on) | sets visitor volume; remembered (`localStorage music:vol`) | Seen |
| M4 | Track per page | route change | home / projects / journal / about / per-project slots; "default", "custom" or "off" | Seen (rules unit-tested) |
| M5 | Crossfade & resume | track changes | Web-Audio gain ramps over `fade` s; previous track resumes where it left off | Seen |
| M6 | Background tab | tab hidden | audio context suspended, resumes on return | Code |
| M7 | Video ducking | an unmuted `<video>` plays | music dips to 18 % (not YouTube/Vimeo iframes) | Code |

## H. Journal / About / dashboard

| ID | Interaction | Implementation | Verified |
|---|---|---|---|
| J1 | Journal list / post pages, editorial shell fade-in | `app/(site)/journal/*`, `components/EditorialPage.tsx` | Code |
| J2 | About page (profile, testimonials, achievements) | `app/(site)/about/page.tsx` | Code |
| A1 | Dashboard: unsaved-changes guard (`beforeunload`), live section previews, media picker, drag-drop upload | `components/admin/*` | Seen (partly) |

## Known accessibility hooks

Home renders a screen-reader `<main>` with the project list (`app/(site)/page.tsx`); `aria-*`/`sr-only`
used in navigation, loader, case studies, Songs of Saaja tables/hotspots, music control. A full
keyboard/screen-reader audit has **not** been done.
