/**
 * Per-project look for the case-study page: colours, font, hero style and
 * an optional pattern band. Each project can feel like its own world
 * (Songs of Saaja: dark earth, cream bands, clay + gold, Marcellus SC)
 * while sharing the same blocks. Empty = the site's normal editorial look.
 */
import type { MusicSlot } from "./music";

export const HERO_STYLES = ["classic", "art"] as const;
export const THEME_FONTS = ["site", "marcellus-sc", "instrument-serif", "syne"] as const;
/**
 * sections: the page is built from the dashboard's sections (the default).
 * Any other value is a page built one-to-one from a Figma frame
 * (components/stories) that still takes its title, statement, role, tools
 * and video from the dashboard.
 */
export const PAGE_TEMPLATES = ["sections", "songs-of-saaja"] as const;

export type ProjectTheme = {
  /** "site" keeps the global look; "custom" applies the colours below */
  mode?: "site" | "custom";
  /** page background + text */
  bg?: string;
  ink?: string;
  /** the alternate band (e.g. cream sections) + its text */
  alt?: string;
  altInk?: string;
  /** highlight colours: ==text== uses accent, ^^text^^ uses accent2 */
  accent?: string;
  accent2?: string;
  /** chip outline / text on the alternate band */
  chip?: string;
  font?: (typeof THEME_FONTS)[number];
  /** classic: big title then image · art: the key art leads (title is in the art) */
  heroStyle?: (typeof HERO_STYLES)[number];
  /** a repeating pattern strip under the hero (and as a section edge) */
  band?: string;
  /** how the page is built — see PAGE_TEMPLATES */
  template?: (typeof PAGE_TEMPLATES)[number];
  /** background music on this project's page (lib/music.ts) */
  music?: MusicSlot;
};

export const THEME_PRESETS: Record<string, { label: string; theme: ProjectTheme }> = {
  site: { label: "Site default", theme: { mode: "site" } },
  earth: {
    label: "Earth (dark + cream)",
    theme: { mode: "custom", bg: "#161412", ink: "#faf8e9", alt: "#f8ecd6", altInk: "#161412", accent: "#c68c72", accent2: "#f2bc4c", chip: "#305542", font: "marcellus-sc", heroStyle: "art" },
  },
  ink: {
    label: "Ink (dark)",
    theme: { mode: "custom", bg: "#0e0e10", ink: "#f2f1ec", alt: "#1b1b1f", altInk: "#f2f1ec", accent: "#9fc3ff", accent2: "#ffd27a", chip: "#9fc3ff", font: "site", heroStyle: "classic" },
  },
};

const FONT_VARS: Record<string, string> = {
  "marcellus-sc": "var(--font-marcellus-sc), Georgia, serif",
  "instrument-serif": "var(--font-instrument-serif), Georgia, serif",
  syne: "var(--font-syne), sans-serif",
};

const mixLine = (ink: string) => `color-mix(in srgb, ${ink} 18%, transparent)`;
const mixDim = (ink: string) => `color-mix(in srgb, ${ink} 62%, transparent)`;

/** theme → CSS custom properties on the case-study root (empty object = site look) */
export function themeVars(t: ProjectTheme | undefined): Record<string, string> {
  if (!t || t.mode !== "custom") return {};
  const v: Record<string, string> = {};
  if (t.bg) {
    v["--paper"] = t.bg;
    v["--base"] = t.bg; // stays the page colour inside alternate bands (solid chips)
  }
  if (t.ink) v["--base-ink"] = t.ink;
  if (t.ink) {
    v["--ink"] = t.ink;
    v["--ink-dim"] = mixDim(t.ink);
    v["--line"] = mixLine(t.ink);
  }
  v["--alt"] = t.alt || t.bg || "";
  v["--alt-ink"] = t.altInk || t.ink || "";
  if (t.accent) v["--hl"] = t.accent;
  if (t.accent2) v["--hl2"] = t.accent2;
  if (t.chip) v["--chip"] = t.chip;
  if (t.font && t.font !== "site") {
    v["--font-display"] = FONT_VARS[t.font];
    v["--cs-font"] = FONT_VARS[t.font];
  }
  return v;
}
