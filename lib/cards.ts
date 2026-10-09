/**
 * Card sections — numbered steps / process cards (e.g. Research → Concept →
 * Core loop → Level design). Each card: title, short text, optional tag line
 * ("Research → Cultural foundation").
 *
 *   vertical    a timeline: cards stacked, joined by a connector line
 *   horizontal  a row of cards, numbers joined by a line (phones: stacked)
 *   path        steps along a winding dashed path that draws as you scroll
 *               (each step can carry an image and its tag as a chip)
 *   range       a start → end span (e.g. Draft 1 ··· Draft 8) with a note between
 *   auto        a few short cards → horizontal, otherwise vertical
 */
import type { GalleryItem } from "./gallery";

export const CARD_LAYOUTS = ["auto", "vertical", "horizontal", "path", "range"] as const;
export type CardLayout = (typeof CARD_LAYOUTS)[number];

export type Card = { title: string; body: string; tag?: string; image?: GalleryItem };

export type CardsPlan = {
  layout: Exclude<CardLayout, "auto">;
  /** horizontal: columns on wide screens */
  columns: number;
};

export function planCards(cards: Card[], requested: CardLayout = "auto"): CardsPlan {
  const n = cards.length;
  const avg = n ? cards.reduce((s, c) => s + c.body.length, 0) / n : 0;
  const layout = requested !== "auto" ? requested : n >= 2 && n <= 4 && avg <= 160 ? "horizontal" : "vertical";
  // 2–4 in one row; more wrap into rows of 3 (or 4 when it divides evenly)
  const columns = layout === "horizontal" ? (n <= 4 ? Math.max(1, n) : n % 4 === 0 ? 4 : 3) : 1;
  return { layout, columns };
}
