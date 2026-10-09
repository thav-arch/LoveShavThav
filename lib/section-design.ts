/**
 * Section design — how a case-study section combines its text and images.
 *
 * lib/gallery.ts decides how the IMAGES are arranged and where the text goes
 * (above / below / beside / over / inside). This file decides the rest of the
 * composition: column balance, vertical alignment, text alignment, width,
 * spacing, the look of text over an image, and the order on phones.
 *
 * Every setting has "auto". resolveDesign() turns auto into a concrete value
 * from the content itself (amount of text, number and shape of images, how
 * bright the image is where the text sits). It is pure: the server runs it
 * once when a page is cached, the dashboard preview runs the same code.
 * The site renders the result as data-attributes + CSS — no layout script.
 */
import type { Edge, HeadingStyle, Tone } from "./blocks";
import type { ResolvedLayout, ResolvedText, TextPlacement } from "./gallery";

export const SPLITS = ["auto", "narrow", "even", "wide"] as const;
export const VALIGNS = ["auto", "top", "center", "sticky"] as const;
export const ALIGNS = ["auto", "left", "center"] as const;
export const WIDTHS = ["auto", "contained", "wide", "full"] as const;
export const SPACINGS = ["auto", "compact", "normal", "airy"] as const;
export const OVERLAY_POS = ["auto", "bottom-left", "bottom-right", "top-left", "center"] as const;
export const OVERLAY_STYLES = ["auto", "scrim", "panel", "light"] as const;
export const MOBILE_ORDERS = ["auto", "text-first", "media-first"] as const;
export { TONES, EDGES, HEADINGS } from "./blocks";

type Auto<T extends readonly string[]> = T[number];
type Fixed<T extends readonly string[]> = Exclude<T[number], "auto">;

/** what the editor stores (all optional, missing = auto) */
export type SectionDesign = {
  split?: Auto<typeof SPLITS>;
  valign?: Auto<typeof VALIGNS>;
  align?: Auto<typeof ALIGNS>;
  width?: Auto<typeof WIDTHS>;
  spacing?: Auto<typeof SPACINGS>;
  overlayPos?: Auto<typeof OVERLAY_POS>;
  overlayStyle?: Auto<typeof OVERLAY_STYLES>;
  mobile?: Auto<typeof MOBILE_ORDERS>;
  /** base page colours or the alternate band (lib/blocks.ts) */
  tone?: Tone;
  /** torn-paper or pattern edges on the band */
  edge?: Edge;
  heading?: HeadingStyle;
  /** chips: outlined pills or solid (page-colour) pills */
  chips?: "outline" | "solid";
};

/** what the site renders */
export type ResolvedDesign = {
  split: Fixed<typeof SPLITS>;
  valign: Fixed<typeof VALIGNS>;
  align: Fixed<typeof ALIGNS>;
  width: Fixed<typeof WIDTHS>;
  spacing: Fixed<typeof SPACINGS>;
  overlayPos: Fixed<typeof OVERLAY_POS>;
  overlayStyle: Fixed<typeof OVERLAY_STYLES>;
  mobile: Fixed<typeof MOBILE_ORDERS>;
  /** strength of the dark scrim behind white text (0–1), from the image brightness */
  scrim: number;
  tone: Tone;
  edge: Edge;
  heading: HeadingStyle;
  chips: "outline" | "solid";
};

export type DesignContext = {
  placement: ResolvedText;
  layout?: ResolvedLayout;
  /** number of images */
  n: number;
  textLength: number;
  /** width ÷ height of each image */
  ratios: number[];
  /** brightness (0–1) of the overlay image on a 3×3 grid, row by row, if known */
  tone?: number[];
};

const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length ? s[Math.floor(s.length / 2)] : 1.6;
};
/** which cells of the 3×3 brightness grid sit under the text for each position */
const REGION: Record<Fixed<typeof OVERLAY_POS>, number[]> = {
  "bottom-left": [6, 7],
  "bottom-right": [7, 8],
  "top-left": [0, 1],
  center: [3, 4, 5],
};

export function resolveDesign(d: SectionDesign = {}, ctx: DesignContext): ResolvedDesign {
  const { placement, layout, n, textLength } = ctx;
  const side = placement === "left" || placement === "right";
  const overlay = placement === "overlay";
  const portraits = n > 0 && median(ctx.ratios) < 0.9;

  // side by side: long text or portrait images get an even split
  const split = d.split && d.split !== "auto" ? d.split : textLength > 900 || portraits ? "even" : "narrow";

  // short text centres against the images; a tall image stack keeps the text in view
  const valign =
    d.valign && d.valign !== "auto" ? d.valign : textLength <= 450 ? "center" : n > 1 || portraits ? "sticky" : "top";

  const overlayPos =
    d.overlayPos && d.overlayPos !== "auto" ? d.overlayPos : textLength > 0 && textLength <= 80 ? "center" : "bottom-left";

  const statement = n === 0 && textLength > 0 && textLength <= 220; // a short text-only section
  const align = d.align && d.align !== "auto" ? d.align : (overlay && overlayPos === "center") || statement ? "center" : "left";

  let width: ResolvedDesign["width"] =
    d.width && d.width !== "auto"
      ? d.width
      : overlay && layout === "full" && n === 1
        ? "full"
        : layout === "carousel"
          ? "full"
          : statement
            ? "contained"
            : "wide";
  if (side && width === "full") width = "wide"; // a text column can't bleed to the edge

  const spacing = d.spacing && d.spacing !== "auto" ? d.spacing : width === "full" || statement ? "airy" : "normal";

  // contrast: how bright is the image where the text sits?
  const region = ctx.tone?.length === 9 ? REGION[overlayPos].map((k) => ctx.tone![k]) : null;
  const luma = region ? region.reduce((a, b) => a + b, 0) / region.length : 0.45; // unknown → assume mid
  const overlayStyle =
    d.overlayStyle && d.overlayStyle !== "auto"
      ? d.overlayStyle
      : textLength > 280
        ? "panel" // longer text always gets a solid card
        : luma > 0.68
          ? "light" // bright area: dark text on a light card
          : "scrim";
  // darker scrim over brighter images (white text needs ~4.5:1 contrast)
  const scrim = clamp(0.4 + luma * 0.55, 0.45, 0.85);

  // phones stack everything: keep the natural reading order
  const mobile =
    d.mobile && d.mobile !== "auto" ? d.mobile : placement === "bottom" || placement === "overlay" ? "media-first" : "text-first";

  return {
    split,
    valign,
    align,
    width,
    spacing,
    overlayPos,
    overlayStyle,
    mobile,
    scrim: Math.round(scrim * 100) / 100,
    tone: d.tone ?? "base",
    edge: d.edge ?? "none",
    heading: d.heading ?? "default",
    chips: d.chips ?? "outline",
  };
}

/* ---------------------------------------------------------------- presets */

export type Preset = { key: string; label: string; hint: string; text: TextPlacement; design: SectionDesign };

/** one click sets a whole composition; everything can still be fine-tuned */
export const PRESETS: Preset[] = [
  { key: "auto", label: "Auto", hint: "Everything decided from your text and images", text: "auto", design: {} },
  { key: "classic", label: "Classic", hint: "Heading left, text right, images below", text: "top", design: { align: "left", width: "wide" } },
  { key: "statement", label: "Statement", hint: "Centred text above, generous space", text: "top", design: { align: "center", width: "contained", spacing: "airy" } },
  { key: "split", label: "Split", hint: "Text left, images right, centred", text: "left", design: { split: "even", valign: "center" } },
  { key: "split-r", label: "Split reversed", hint: "Images left, text right", text: "right", design: { split: "even", valign: "center" } },
  { key: "story", label: "Sticky story", hint: "Narrow text column that stays while images scroll", text: "left", design: { split: "narrow", valign: "sticky" } },
  { key: "spotlight", label: "Spotlight", hint: "Edge-to-edge image, text centred over it", text: "overlay", design: { overlayPos: "center", width: "full", spacing: "airy" } },
  { key: "caption", label: "Caption", hint: "Image first, text below", text: "bottom", design: { width: "wide" } },
  { key: "tile", label: "Tile", hint: "Text as a tile inside the layout", text: "inline", design: {} },
];

/** the preset that matches the current settings exactly, if any */
export function matchPreset(text: TextPlacement, d: SectionDesign) {
  const norm = (x: SectionDesign) =>
    JSON.stringify(Object.fromEntries(Object.entries(x).filter(([, v]) => v && v !== "auto").sort(([a], [b]) => a.localeCompare(b))));
  return PRESETS.find((p) => p.text === text && norm(p.design) === norm(d))?.key;
}
