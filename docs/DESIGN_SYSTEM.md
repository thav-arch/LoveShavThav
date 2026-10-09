# Design system (as implemented)

> Audited 10 Oct 2026 from `app/globals.css` (2,563 lines), `app/layout.tsx`, `lib/cms/settings-schema.ts`,
> `lib/project-theme.ts`, `components/stories/SongsOfSaaja.css`. There is no separate token file — tokens
> are CSS custom properties, some overridden at runtime from the CMS.

## 1. Colour tokens

Defined in `app/globals.css :root`, then **overridden on `<html>` from Settings → Theme**
(`app/layout.tsx` writes `--bg --fg --paper --ink --accent --font --font-display --ui-case --measure`).

| Token | Default (CSS) | Live value (CMS, 10 Oct) | Used for |
|---|---|---|---|
| `--bg` | #000 | #000000 | 3D world background |
| `--fg` | #fff | #ffffff | world UI text |
| `--dim` | rgba(255,255,255,.46) | — | secondary world text |
| `--paper` | #f1f0ec | #f1f0ec | case study / journal / about background |
| `--ink` | #0b0b0b | #0b0b0b | editorial text |
| `--ink-dim`, `--line` | color-mix of `--ink` (50 % / 14 %) | — | secondary text, rules |
| `--accent` | — | #c9a7ff | accents, highlights |

3D-world look (Settings → Theme, passed to WebGL as uniforms, not CSS): `gridHue` 0, `gridIntensity`
0.55, `cursorWake` on, `wakeStrength` 0.006, `cardRadius` 0.045.

## 2. Typography

- Fonts (all `next/font/google`, `app/layout.tsx`): **Inter Tight** (default body/display, preloaded),
  Space Grotesk, DM Sans, Syne, Instrument Serif, **Marcellus SC** (project themes). Body and display
  fonts are chosen in Settings → Theme; projects with a custom theme can switch to Marcellus SC,
  Instrument Serif or Syne.
- UI text: `--ui: 500 11px/1.2 var(--font)`, letter-spacing ~0.09em, uppercase controlled by
  Settings (`--ui-case`). Used by navigation, buttons, captions, the music control.
- Fluid editorial scale (64 `clamp()` declarations in globals.css), e.g.:
  case-study title `clamp(54px, 12.5vw, 230px)` (phones `clamp(40px, 7vw, 120px)`),
  lede `clamp(20px, 2.2vw, 34px)`, section heading `clamp(28px, 3.3vw, 54px)`,
  body `clamp(16px, 1.3vw, 19px)`, meta 15px.
- Reading width: Settings → Theme → "editorial" (full width) or "compact" (`--measure: 820px`).

## 3. Spacing & layout

- `--gutter: clamp(16px, 2.2vw, 30px)` — page side margins and corner-navigation offsets.
- Easing: `--ease: cubic-bezier(0.19, 1, 0.22, 1)` (expo-out) for UI; GSAP uses `expo`, `power2/3`.
- Case studies use a 12-column-like grid inside `.cs-content` (`container-type: inline-size`, so
  full-bleed elements use `cqw` units).
- **Breakpoints are inconsistent** (simplification candidate): CSS uses 600, 700, 720, 760, 820, 860,
  900/901, 980 and 1023px, plus `(hover: none)`; the 3D layout (`lib/layout.ts`) switches at
  width < 700 → mobile, < 1100 or aspect < 1.15 → tablet, else desktop.

## 4. Home (3D world) visual language

- Film strip of project frames over rollers (desktop: long zig-zag; tablet: gentler fold; mobile: one
  dominant frame). Frame width follows each cover's aspect ratio; floor reflection under each frame.
- Card label printed into the card texture (title up to 2 lines, "SUBTITLE · YEAR" meta, a ring + arrow
  indicator) so it bends with the card (`lib/card-label.ts`, `components/shaders/card.ts`).
- Pastel glowing grid floor (`components/shaders/grid.ts`) with a pool of light under the cursor.
- Liquid wake: brief local ripple + subtle colour fringe (`components/shaders/flow.ts`).
- Liquid chrome ring portal (`components/shaders/portal.ts`) for Profile / Playground.
- Corner navigation in `--ui` type: name (TL), Profile (TR), Featured / Full (BL), Playground (BR),
  position counter (bottom centre). Music control sits above Playground (world) or in the free
  bottom-right corner (pages).

## 5. Case-study visual system (section-based pages)

- Header: classic (big title → statement → meta row → hero image) or key-art-first (full-bleed art,
  pattern band, a line drawing down to the statement).
- Section looks (`lib/section-design.ts`): presets Classic, Statement, Split, Split reversed, Sticky
  story, Spotlight, Caption, Tile; fine-tuning for text placement, column split, vertical/text
  alignment, width (contained / wide / full-bleed), spacing, overlay position/style, phone order;
  background tone (base / alt band), edges (torn / pattern), heading styles (kicker, center, ornament,
  rules, dashed, hidden), chips (outline / solid), ornaments.
- Text over images reads the image's stored brightness map (`media.variants.tone`) to pick white
  text + scrim or dark text on a light panel.
- Text highlights: `==text==` → `--hl` (accent), `^^text^^` → `--hl2` (accent 2).

## 6. Per-project themes (`lib/project-theme.ts`)

Presets: **Site default**, **Earth** (bg #161412, ink #faf8e9, alt band #f8ecd6, accent #c68c72,
accent 2 #f2bc4c, chip #305542, Marcellus SC, key-art hero), **Ink** (bg #0e0e10, ink #f2f1ec, accent
#9fc3ff, accent 2 #ffd27a). Plus `template`: `sections` or `songs-of-saaja`, and per-project `music`.
Only Songs of Saaja uses a custom theme today.

## 7. Songs of Saaja page (bespoke)

Frame 1440 × 14275 (Figma node 89:20318). One unit = `100cqw / 1440`; every element placed at its
Figma x/y on desktop (≥ 1024px); one column below. Palette: dark #161412, cream #faf8e9, band
#f8ecd6, gold #f2bc4c, clay #c68c72 / #c78f74, highlight yellows #ffd342 / #fffb8b / #ffc873, sage
#305542 chips, beat tables white with #d1d5db rules and #111827 text. Font: Marcellus SC throughout,
line-height 1.25. Details: `docs/PROJECTS/songs-of-saaja.md`.

## 8. Responsive & motion rules observed

- `prefers-reduced-motion`: honoured in globals.css (4 blocks), SongsOfSaaja.css, the 3D scene
  (`motion.reducedMotion`), transitions (shorter tweens), loader (300 ms minimum instead of 1.5 s).
- Touch: native scrolling on pages; drag on the strip; `(hover: none)` keeps the music volume visible.
