/**
 * Image sections — the layout engine.
 *
 * A case-study section can hold any number of images (and videos) shown as
 *   full      one image per row, natural proportions (a vertical sequence)
 *   rows      justified rows: every image uncropped, rows share one height
 *   grid      uniform cells cropped to one common shape, N columns
 *   collage   editorial "bento" arrangement with a hero tile
 *   carousel  horizontal film strip, scroll-snapped, natural proportions
 * and its text can sit
 *   top       above the images (heading left, text right — the default look)
 *   bottom    below the images (a caption-like reading order)
 *   left/right a sticky column beside the images
 *   overlay   over the hero image, on a soft scrim
 *   inline    inside the layout, as one of the tiles
 *
 * "auto" for either picks what usually works best for the number of images,
 * their shapes and the amount of text (see resolveLayout / resolveText).
 *
 * planGallery() is pure and dependency-free: the server runs it once when a
 * page is cached (so the browser does no layout maths), and the dashboard runs
 * the same function for its live preview. Everything it returns is plain data
 * rendered with CSS grid / flex — no measuring, no layout shift.
 */

export const GALLERY_LAYOUTS = ["auto", "full", "rows", "grid", "collage", "carousel"] as const;
export const TEXT_PLACEMENTS = ["auto", "top", "bottom", "left", "right", "overlay", "inline"] as const;
export type GalleryLayout = (typeof GALLERY_LAYOUTS)[number];
export type TextPlacement = (typeof TEXT_PLACEMENTS)[number];
export type ResolvedLayout = Exclude<GalleryLayout, "auto">;
export type ResolvedText = Exclude<TextPlacement, "auto">;

export type GalleryItem = {
  type: "image" | "video";
  url: string;
  /** small preview (480px WebP) shown while the full image loads */
  sm?: string;
  w?: number;
  h?: number;
  alt: string;
  caption?: string;
  /** manual override: this image gets the hero tile in a collage */
  featured?: boolean;
  /** brightness (0–1) on a 3×3 grid, row by row — picks readable text over the image */
  tone?: number[];
};

/** a placed tile on a 12-column grid; i = item index, -1 = the text tile */
export type Tile = {
  i: number;
  x: number;
  y: number;
  w: number;
  h: number;
  /** width ÷ height the tile is drawn at */
  ratio: number;
  /** phones: the tile spans both columns of the simplified 2-column layout */
  wide?: boolean;
};

export type GalleryPlan = {
  layout: ResolvedLayout;
  text: ResolvedText;
  /** grid / collage: explicit tile placement (12 columns, row units) */
  tiles: Tile[];
  /** grid / collage: total row units (collage rows are square units) */
  rowsTotal: number;
  /** grid: number of columns used */
  columns: number;
  /** grid: the common tile shape (width ÷ height) */
  cell: number;
  /** rows: target row height (px, desktop) */
  rowHeight: number;
  /** carousel: slide height preset */
  slide: "s" | "m" | "l";
  /** item that hosts overlay text (largest tile), -1 if none */
  hero: number;
};

export type PlanInput = {
  items: GalleryItem[];
  layout?: GalleryLayout;
  text?: TextPlacement;
  /** grid: 1–4 columns · carousel: 1 large, 2 medium, 3 small · rows: 1–4 density. 0 = auto */
  columns?: number;
  /** plain-text length of the section's body (drives the text placement) */
  textLength?: number;
};

/* ----------------------------------------------------------------- shapes */

const DEFAULT_RATIO = 16 / 9;
export const ratioOf = (it: Pick<GalleryItem, "w" | "h">) => (it.w && it.h ? it.w / it.h : DEFAULT_RATIO);
type Shape = "pano" | "land" | "square" | "port";
const shapeOf = (r: number): Shape => (r > 2 ? "pano" : r >= 1.25 ? "land" : r > 0.8 ? "square" : "port");
const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
/** how much of an image is lost when drawn at `tile` proportions (0 = none) */
const cropCost = (tile: number, img: number) => Math.abs(Math.log(tile / img));
const NICE = [4 / 5, 1, 4 / 3, 3 / 2, 16 / 9];
const nearestNice = (r: number) => NICE.reduce((a, b) => (Math.abs(Math.log(b / r)) < Math.abs(Math.log(a / r)) ? b : a));
const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length ? (s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2) : DEFAULT_RATIO;
};

/* -------------------------------------------------------- auto decisions */

/** best layout for this set of images, or the requested one when it can work */
export function resolveLayout(items: GalleryItem[], requested: GalleryLayout = "auto"): ResolvedLayout {
  const n = items.length;
  if (n <= 1) return "full";
  if (requested !== "auto") return requested;
  const shapes = new Set(items.map((it) => shapeOf(ratioOf(it))));
  if (n === 2) return "rows"; // a pair: side by side, equal height, uncropped
  if (n <= 4 && shapes.size === 1) return "rows"; // a uniform set reads best as one clean row
  if (n <= 6) return "collage";
  if (n <= 9) return "grid";
  return "carousel"; // long sets: keep the page short, let people browse
}

/** best text placement for this layout and amount of text */
export function resolveText(layout: ResolvedLayout, n: number, textLength: number, requested: TextPlacement = "auto"): ResolvedText {
  if (textLength === 0) return "top"; // heading only
  const canOverlay = n > 0 && (layout === "full" || layout === "collage");
  const canInline = n > 0 && (layout === "collage" || layout === "grid" || layout === "carousel");
  if (requested !== "auto") {
    if (requested === "overlay" && !canOverlay) return "top";
    if (requested === "inline" && !canInline) return "top";
    if (requested === "bottom" && n === 0) return "top";
    return requested;
  }
  if (n === 0) return "top";
  // short captions-like text over a single strong image
  if (layout === "full" && n === 1 && textLength <= 160) return "overlay";
  // short text becomes a tile inside a collage
  if (layout === "collage" && textLength <= 360) return "inline";
  // one or two images and a medium text: editorial side-by-side
  if (n <= 2 && textLength > 160 && textLength <= 1400 && layout !== "carousel") return "left";
  return "top";
}

/* ---------------------------------------------------------------- grid */

function autoColumns(cells: number) {
  if (cells <= 3) return cells;
  if (cells === 4) return 2;
  if (cells <= 6) return 3;
  if (cells <= 8) return 4;
  if (cells === 9) return 3;
  return 4;
}

function planGrid(ratios: number[], textTile: boolean, requestedCols: number) {
  const cells = ratios.length + (textTile ? 1 : 0);
  const cols = clamp(requestedCols || autoColumns(cells), 1, 4);
  const cell = nearestNice(clamp(median(ratios), 0.75, 1.78)); // one common shape
  const unit = 12 / cols;
  const tiles: Tile[] = [];
  const order = textTile ? [-1, ...ratios.map((_, i) => i)] : ratios.map((_, i) => i);
  const fullRows = Math.floor(cells / cols) * cols;
  order.forEach((i, k) => {
    const row = Math.floor(k / cols);
    // a short last row stretches to fill the width (no orphan gaps)
    const left = cells - fullRows;
    const inLast = k >= fullRows && left > 0;
    const w = inLast && 12 % left === 0 ? 12 / left : unit;
    const x = inLast ? (k - fullRows) * w : (k % cols) * unit;
    tiles.push({ i, x, y: row, w, h: 1, ratio: (cell * w) / unit });
  });
  return { tiles: phonePairs(tiles), columns: cols, rowsTotal: Math.ceil(cells / cols), cell };
}

/* ------------------------------------------------------------- collage */

/** templates on a 12-column grid with square row units: [x, y, w, h] */
type Tpl = { rows: number; t: [number, number, number, number][] };
const TEMPLATES: Record<number, Tpl[]> = {
  2: [
    { rows: 6, t: [[0, 0, 7, 6], [7, 0, 5, 6]] },
    { rows: 8, t: [[0, 0, 6, 8], [6, 0, 6, 8]] },
    { rows: 5, t: [[0, 0, 8, 5], [8, 0, 4, 5]] },
  ],
  3: [
    { rows: 8, t: [[0, 0, 8, 8], [8, 0, 4, 4], [8, 4, 4, 4]] },
    { rows: 8, t: [[0, 0, 5, 8], [5, 0, 7, 4], [5, 4, 7, 4]] },
    { rows: 11, t: [[0, 0, 12, 6], [0, 6, 6, 5], [6, 6, 6, 5]] },
    { rows: 7, t: [[0, 0, 4, 7], [4, 0, 4, 7], [8, 0, 4, 7]] },
    { rows: 8, t: [[0, 0, 12, 5], [0, 5, 6, 3], [6, 5, 6, 3]] }, // wide / panoramic
  ],
  4: [
    { rows: 10, t: [[0, 0, 8, 6], [8, 0, 4, 6], [0, 6, 4, 4], [4, 6, 8, 4]] },
    { rows: 10, t: [[0, 0, 12, 6], [0, 6, 4, 4], [4, 6, 4, 4], [8, 6, 4, 4]] },
    { rows: 10, t: [[0, 0, 7, 5], [7, 0, 5, 5], [0, 5, 5, 5], [5, 5, 7, 5]] },
    { rows: 8, t: [[0, 0, 6, 8], [6, 0, 6, 4], [6, 4, 3, 4], [9, 4, 3, 4]] },
    { rows: 8, t: [[0, 0, 6, 4], [6, 0, 6, 4], [0, 4, 6, 4], [6, 4, 6, 4]] }, // landscapes
  ],
  5: [
    { rows: 8, t: [[0, 0, 6, 8], [6, 0, 3, 4], [9, 0, 3, 4], [6, 4, 3, 4], [9, 4, 3, 4]] },
    { rows: 9, t: [[0, 0, 8, 5], [8, 0, 4, 5], [0, 5, 4, 4], [4, 5, 4, 4], [8, 5, 4, 4]] },
    { rows: 10, t: [[0, 0, 5, 10], [5, 0, 7, 4], [5, 4, 3, 3], [8, 4, 4, 3], [5, 7, 7, 3]] },
    { rows: 7, t: [[0, 0, 7, 4], [7, 0, 5, 4], [0, 4, 4, 3], [4, 4, 4, 3], [8, 4, 4, 3]] }, // landscapes
  ],
  6: [
    { rows: 10, t: [[0, 0, 8, 6], [8, 0, 4, 3], [8, 3, 4, 3], [0, 6, 4, 4], [4, 6, 4, 4], [8, 6, 4, 4]] },
    { rows: 10, t: [[0, 0, 4, 6], [0, 6, 4, 4], [4, 0, 4, 4], [4, 4, 4, 6], [8, 0, 4, 5], [8, 5, 4, 5]] },
    { rows: 7, t: [[0, 0, 6, 4], [6, 0, 6, 4], [0, 4, 3, 3], [3, 4, 3, 3], [6, 4, 3, 3], [9, 4, 3, 3]] }, // landscapes
  ],
};

const area = ([, , w, h]: number[]) => w * h;
const readingOrder = (a: number[], b: number[]) => a[1] - b[1] || a[0] - b[0];

/** split a long set into balanced chunks of 3–5 (each chunk gets its own template) */
function chunks(n: number): number[] {
  if (n <= 6) return [n];
  const parts = Math.ceil(n / 5);
  const base = Math.floor(n / parts);
  return Array.from({ length: parts }, (_, k) => base + (k < n % parts ? 1 : 0));
}

/**
 * Pick the template + mirror (+ text slot) that crops the images least,
 * keeping their order (images fill tiles in reading order). A featured image
 * is moved into the largest tile; the text tile never takes the largest tile.
 */
function planCollage(ratios: number[], textTile: boolean, featured: number) {
  const ids = textTile ? [-1, ...ratios.map((_, i) => i)] : ratios.map((_, i) => i);
  const r = (i: number) => (i === -1 ? 1.1 : ratios[i]); // text reads best in a squarish tile
  const tiles: Tile[] = [];
  let y0 = 0;
  let start = 0;
  let flip = false;
  for (const size of chunks(ids.length)) {
    const group = ids.slice(start, start + size);
    start += size;
    let best: { cost: number; rows: number; t: number[][]; order: number[] } | null = null;
    for (const tpl of TEMPLATES[size] ?? []) {
      for (const mirror of [flip, !flip]) {
        const t = tpl.t.map(([x, y, w, h]) => [mirror ? 12 - x - w : x, y, w, h]).sort(readingOrder);
        const big = t.reduce((m, c, k) => (area(c) > area(t[m]) ? k : m), 0);
        const total = t.reduce((s, c) => s + area(c), 0);
        const imgs = group.filter((i) => i !== -1);
        // the text tile may take any slot except the hero; images keep their order around it
        const smaller = t.map((_, k) => k).filter((k) => area(t[k]) < area(t[big]));
        const textSlots = group.includes(-1) ? (smaller.length ? smaller : t.map((_, k) => k).filter((k) => k !== big)) : [-1];
        for (const ts of textSlots) {
          const order: number[] = [];
          let next = 0;
          for (let k = 0; k < t.length; k++) order.push(k === ts ? -1 : imgs[next++]);
          const f = featured >= 0 ? order.indexOf(featured) : -1; // (-1 is also the text tile's id)
          if (f >= 0 && f !== big) [order[f], order[big]] = [order[big], order[f]];
          // crop cost weighted by tile area and squared: a heavy crop on the hero
          // tile is far worse than a slight crop on a small one
          let cost = 0;
          t.forEach((c, k) => {
            const loss = cropCost(c[2] / c[3], r(order[k]));
            cost += (area(c) / total) * loss * loss;
          });
          cost += mirror === flip ? 0 : 0.01; // prefer alternating sides between chunks
          cost += ts > 0 ? ts * 0.004 : 0; // text early in reading order, all else equal
          if (!best || cost < best.cost) best = { cost, rows: tpl.rows, t, order };
        }
      }
    }
    if (!best) break;
    best.t.forEach(([x, y, w, h], k) => tiles.push({ i: best!.order[k], x, y: y + y0, w, h, ratio: w / h }));
    y0 += best.rows;
    flip = !flip;
  }
  const big = tiles.reduce((m, t, k) => (t.w * t.h > tiles[m].w * tiles[m].h ? k : m), 0);
  return { tiles: phonePairs(tiles, big), rowsTotal: y0 };
}

/**
 * Phones use 2 columns: the hero and the text tile span both; the other tiles
 * pair up in order, and one that can't find a partner spans both (no gaps).
 */
function phonePairs(tiles: Tile[], hero = -1) {
  let open = -1; // index of a half-width tile waiting for a partner
  tiles.forEach((t, k) => {
    t.wide = k === hero || t.i === -1;
    if (t.wide) {
      if (open >= 0) tiles[open].wide = true;
      open = -1;
    } else if (open >= 0) open = -1;
    else open = k;
  });
  if (open >= 0) tiles[open].wide = true;
  return tiles;
}

/* ------------------------------------------------------------------ plan */

export function planGallery({ items, layout = "auto", text = "auto", columns = 0, textLength = 0 }: PlanInput): GalleryPlan {
  const n = items.length;
  const resolved = resolveLayout(items, layout);
  const placement = resolveText(resolved, n, textLength, text);
  const ratios = items.map(ratioOf);
  const textTile = placement === "inline";
  const featured = items.findIndex((it) => it.featured);
  const plan: GalleryPlan = { layout: resolved, text: placement, tiles: [], rowsTotal: 0, columns: 0, cell: 0, rowHeight: 0, slide: "m", hero: -1 };

  if (resolved === "grid") Object.assign(plan, planGrid(ratios, textTile, columns));
  else if (resolved === "collage") Object.assign(plan, planCollage(ratios, textTile, featured));
  else if (resolved === "rows") {
    if (columns) plan.rowHeight = [520, 380, 290, 220][clamp(columns, 1, 4) - 1]; // 1 = large … 4 = compact
    else {
      // auto: aim for ~3 images per row (all of them when there are ≤ 4), sized so
      // they fit one ~1150px row; flex-grow then stretches the row to the full width
      const perRow = n <= 4 ? n : 3;
      const sum = ratios.slice(0, perRow).reduce((a, b) => a + b, 0);
      plan.rowHeight = Math.round(clamp(1150 / sum, 200, 520));
    }
  } else if (resolved === "carousel") {
    const portraits = ratios.filter((r) => r < 0.9).length;
    plan.slide = columns === 1 ? "l" : columns === 3 ? "s" : columns === 2 ? "m" : portraits > n / 2 ? "m" : n <= 4 ? "l" : "m";
  }

  // overlay text sits on the biggest image
  if (placement === "overlay") {
    const imgTiles = plan.tiles.filter((t) => t.i >= 0);
    plan.hero = imgTiles.length ? imgTiles.reduce((a, b) => (b.w * b.h > a.w * a.h ? b : a)).i : 0;
  }
  return plan;
}

/** `sizes` for next/image so each tile downloads an image close to its drawn width */
export function tileSizes(plan: GalleryPlan, tile?: Tile, sideText = false) {
  const share = sideText ? 0.64 : 1; // text column takes about a third beside the images
  if (plan.layout === "carousel") return plan.slide === "l" ? "(max-width: 700px) 86vw, 70vw" : "(max-width: 700px) 70vw, 40vw";
  if (plan.layout === "full") return `(max-width: 900px) 100vw, ${Math.round(90 * share)}vw`;
  if (plan.layout === "rows") return `(max-width: 700px) 50vw, ${Math.round(45 * share)}vw`;
  if (!tile) return "50vw";
  const desk = Math.max(20, Math.round((tile.w / 12) * 92 * share));
  return `(max-width: 700px) ${tile.wide ? 100 : 50}vw, ${desk}vw`;
}

/**
 * clamp a single image's drawn proportions to a sensible editorial range —
 * tall images are trimmed, but wide panoramas (maps, layout plans) show whole
 */
export const fullRatio = (r: number) => clamp(r, 4 / 5, 5);
