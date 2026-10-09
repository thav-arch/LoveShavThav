"use client";

import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { CARD_LAYOUTS, planCards, type Card, type CardLayout, type CardsPlan } from "@/lib/cards";
import {
  fullRatio,
  planGallery,
  ratioOf,
  type GalleryItem,
  type GalleryLayout,
  type GalleryPlan,
  type ResolvedLayout,
  type TextPlacement,
} from "@/lib/gallery";
import {
  ALIGNS,
  matchPreset,
  MOBILE_ORDERS,
  OVERLAY_POS,
  OVERLAY_STYLES,
  PRESETS,
  resolveDesign,
  SPACINGS,
  SPLITS,
  VALIGNS,
  WIDTHS,
  type ResolvedDesign,
  type SectionDesign,
} from "@/lib/section-design";
import { MediaPicker, type MediaItem } from "./ui";
import {
  DIVIDERS,
  EDGES,
  HEADINGS,
  parseTable,
  SECTION_KINDS,
  tableToText,
  TONES,
  type BoardData,
  type DividerStyle,
  type Ornament,
  type SectionKind,
  type TableData,
} from "@/lib/blocks";

/** everything a case-study section holds besides its id / heading / text */
export type SectionContent = {
  kind: SectionKind;
  items: GalleryItem[];
  layout: GalleryLayout;
  text: TextPlacement;
  columns: number;
  design: SectionDesign;
  cards: Card[];
  cardLayout: CardLayout;
  subtitle: string;
  chips: string[];
  ornaments: Ornament[];
  table: TableData;
  board: BoardData;
  divider: DividerStyle;
};

export const emptySectionContent: SectionContent = {
  kind: "media",
  items: [],
  layout: "auto",
  text: "auto",
  columns: 0,
  design: {},
  cards: [],
  cardLayout: "auto",
  subtitle: "",
  chips: [],
  ornaments: [],
  table: { header: true, rows: [] },
  board: { center: null, refs: [] },
  divider: "footprints",
};

const KIND_LABEL: Record<SectionKind, string> = { media: "Images", cards: "Cards", table: "Table", board: "Board", divider: "Divider" };

type Opt<T extends string> = { v: T; label: string; hint: string; disabled?: boolean };

const LAYOUTS: Opt<GalleryLayout>[] = [
  { v: "auto", label: "Auto", hint: "Picks the best layout for the number and shapes of your images" },
  { v: "full", label: "Full width", hint: "One image per row, natural proportions" },
  { v: "rows", label: "Rows", hint: "Side by side, never cropped — rows share one height" },
  { v: "grid", label: "Grid", hint: "Even tiles cropped to one shape, choose the columns" },
  { v: "collage", label: "Collage", hint: "Editorial mix of large and small tiles, crops as little as possible" },
  { v: "carousel", label: "Carousel", hint: "Horizontal strip people swipe or drag through" },
];
const TEXTS: Opt<TextPlacement>[] = [
  { v: "auto", label: "Auto", hint: "Chooses from the amount of text and the layout" },
  { v: "top", label: "Above", hint: "Heading and text above" },
  { v: "bottom", label: "Below", hint: "Images first, text underneath" },
  { v: "left", label: "Left", hint: "Text column on the left" },
  { v: "right", label: "Right", hint: "Text column on the right" },
  { v: "overlay", label: "Over image", hint: "Over the largest image (Full width / Collage). Best for short text" },
  { v: "inline", label: "Inside layout", hint: "Text becomes a tile in the Grid, Collage or Carousel" },
];
const CARD_OPTS: Opt<CardLayout>[] = [
  { v: "auto", label: "Auto", hint: "A few short cards side by side, otherwise a vertical timeline" },
  { v: "vertical", label: "Vertical", hint: "A timeline: cards stacked and joined by a line" },
  { v: "horizontal", label: "Horizontal", hint: "A row of cards (phones show them stacked)" },
  { v: "path", label: "Path", hint: "Steps along a winding dashed trail that draws as you scroll; each step can have an image" },
  { v: "range", label: "Range", hint: "First ··· middle ··· last, e.g. Draft 1 → Draft 8" },
];
const NAMES: Record<string, string> = {
  full: "Full width", rows: "Rows", grid: "Grid", collage: "Collage", carousel: "Carousel", top: "Above", bottom: "Below", left: "Left",
  right: "Right", overlay: "Over image", inline: "Inside layout", vertical: "Vertical", horizontal: "Horizontal", narrow: "Narrow ⅓",
  even: "Even ½", wide: "Wide", center: "Centre", sticky: "Sticky", contained: "Contained", compact: "Compact", normal: "Normal",
  airy: "Airy", "bottom-left": "Bottom left", "bottom-right": "Bottom right", "top-left": "Top left", scrim: "Scrim", panel: "Dark panel",
  light: "Light panel", "text-first": "Text first", "media-first": "Media first", path: "Path", range: "Range",
  "torn-top": "Torn top", "torn-bottom": "Torn bottom", kicker: "Title + subtitle", ornament: "Star ornament", rules: "Side rules",
  dashed: "Dashed line", hidden: "Hidden", footprints: "Footprints", pattern: "Pattern", rule: "Line", outline: "Outline", solid: "Solid",
};
const HEADING_HINTS: Record<string, string> = {
  default: "Number + heading (the classic look)",
  center: "Centred heading",
  kicker: "Large heading with a small subtitle under it",
  ornament: "Centred heading with a star between two lines",
  rules: "Centred heading with lines running to both edges",
  dashed: "Accent-coloured heading with a dashed line running right",
  hidden: "No visible heading (still read by screen readers)",
};
const label = (v: string) => NAMES[v] ?? v[0].toUpperCase() + v.slice(1);

/** a library file → a gallery item (size, preview, brightness and alt travel with it) */
export const toItem = (m: MediaItem): GalleryItem => ({
  type: m.mimeType.startsWith("video") ? "video" : "image",
  url: m.url,
  sm: m.variants.sm ?? undefined,
  w: m.width ?? undefined,
  h: m.height ?? undefined,
  tone: (m.variants as { tone?: number[] }).tone,
  alt: m.alt ?? "",
  caption: "",
});

const plainLength = (md: string) => md.replace(/[#>*_`~\-[\]()]/g, "").replace(/\s+/g, " ").trim().length;

/* ================================================================ editor */

export function SectionEditor({
  value,
  onChange,
  title,
  body,
}: {
  value: SectionContent;
  onChange: (patch: Partial<SectionContent>) => void;
  title: string;
  body: string;
}) {
  const [device, setDevice] = useState<"desktop" | "phone">("desktop");
  const textLength = plainLength(body);
  const kind = value.kind;
  const cards = kind === "cards";
  const nonMedia = kind !== "media"; // cards / table / board / divider: text above, below or beside
  const items = nonMedia ? [] : value.items;

  // the same decisions the site makes (lib/gallery, lib/cards, lib/section-design)
  const plan = !nonMedia && items.length ? planGallery({ items, layout: value.layout, text: value.text, columns: value.columns, textLength }) : null;
  const cardsPlan = cards && value.cards.length ? planCards(value.cards, value.cardLayout) : null;
  const placement = nonMedia ? (["left", "right", "bottom"].includes(value.text) ? (value.text as "left" | "right" | "bottom") : "top") : (plan?.text ?? "top");
  const hero = plan && placement === "overlay" ? items[Math.max(0, plan.hero)] : undefined;
  const design = resolveDesign(value.design, {
    placement,
    layout: plan?.layout,
    n: cards ? value.cards.length : items.length,
    textLength,
    ratios: items.map(ratioOf),
    tone: hero?.tone,
  });
  const setDesign = (patch: SectionDesign) => onChange({ design: { ...value.design, ...patch } });

  const canOverlay = !!plan && (plan.layout === "full" || plan.layout === "collage");
  const canInline = !!plan && ["grid", "collage", "carousel"].includes(plan.layout);
  const textOpts = TEXTS.filter((t) => !nonMedia || ["auto", "top", "bottom", "left", "right"].includes(t.v)).map((t) => ({
    ...t,
    disabled: !nonMedia && ((t.v === "overlay" && !canOverlay) || (t.v === "inline" && !canInline)),
  }));
  const presets = PRESETS.filter((p) => !nonMedia || ["auto", "top", "bottom", "left", "right"].includes(p.text));
  const current = matchPreset(value.text, value.design);
  const side = placement === "left" || placement === "right";
  const hasContent =
    kind === "cards" ? value.cards.length > 0 : kind === "table" ? value.table.rows.length > 0 : kind === "board" ? !!value.board.center : kind === "divider" ? true : items.length > 0;

  return (
    <div className="a-gallery">
      <div className="a-gallery-bar">
        <b>Content</b>
        <div className="a-seg" role="radiogroup" aria-label="Section content">
          {SECTION_KINDS.map((k) => (
            <button key={k} type="button" role="radio" aria-checked={value.kind === k} aria-pressed={value.kind === k} onClick={() => onChange({ kind: k })}>
              {KIND_LABEL[k]}
            </button>
          ))}
        </div>
      </div>

      {kind === "cards" ? (
        <CardsEditor value={value} onChange={onChange} resolved={cardsPlan?.layout} />
      ) : kind === "table" ? (
        <TableEditor value={value.table} onChange={(table) => onChange({ table })} />
      ) : kind === "board" ? (
        <BoardEditor value={value.board} onChange={(board) => onChange({ board })} />
      ) : kind === "divider" ? (
        <Choice
          label="Divider"
          value={value.divider}
          options={DIVIDERS.map((v) => ({ v, label: label(v), hint: v === "footprints" ? "Footprints walking down branching trails (steps in as you scroll)" : v === "pattern" ? "The project's pattern band (set in the project theme)" : "A thin line" }))}
          onChange={(divider) => onChange({ divider })}
        />
      ) : (
        <MediaEditor value={value} onChange={onChange} plan={plan} />
      )}

      {kind !== "divider" && <ExtrasEditor value={value} onChange={onChange} />}

      <div className="a-gallery-controls a-compose">
        <div className="a-field">
          <span>Composition {current && <em className="a-hint">· {PRESETS.find((p) => p.key === current)?.label}</em>}</span>
          <div className="a-presets">
            {presets.map((p) => (
              <button
                key={p.key}
                type="button"
                className="a-preset"
                aria-pressed={current === p.key}
                title={p.hint}
                onClick={() => onChange({ text: p.text, design: { ...p.design } })}
              >
                <PresetIcon text={p.text} design={p.design} />
                <span>{p.label}</span>
              </button>
            ))}
          </div>
        </div>
        <Choice label="Text" value={value.text} options={textOpts} resolved={value.text === "auto" && hasContent ? label(placement) : undefined} onChange={(text) => onChange({ text })} />

        <details className="a-fine">
          <summary>Fine-tune alignment, width and spacing</summary>
          <div className="a-gallery-controls">
            {side && (
              <>
                <Choice label="Column split" value={value.design.split ?? "auto"} options={opts(SPLITS, { narrow: "Text ⅓ · media ⅔", even: "Half and half", wide: "Text ⅗ · media ⅖" })} resolved={auto(value.design.split, design.split)} onChange={(split) => setDesign({ split })} />
                <Choice label="Vertical alignment" value={value.design.valign ?? "auto"} options={opts(VALIGNS, { top: "Text starts at the top", center: "Text centred against the media", sticky: "Text stays in view while the media scrolls" })} resolved={auto(value.design.valign, design.valign)} onChange={(valign) => setDesign({ valign })} />
              </>
            )}
            {placement === "overlay" && (
              <>
                <Choice label="Text position" value={value.design.overlayPos ?? "auto"} options={opts(OVERLAY_POS, {})} resolved={auto(value.design.overlayPos, design.overlayPos)} onChange={(overlayPos) => setDesign({ overlayPos })} />
                <Choice
                  label="Text style"
                  value={value.design.overlayStyle ?? "auto"}
                  options={opts(OVERLAY_STYLES, { auto: "Reads the image's brightness under the text", scrim: "White text on a soft shadow", panel: "White text on a dark frosted card", light: "Dark text on a light frosted card" })}
                  resolved={auto(value.design.overlayStyle, design.overlayStyle)}
                  onChange={(overlayStyle) => setDesign({ overlayStyle })}
                />
              </>
            )}
            {!side && placement !== "inline" && (
              <Choice label="Text alignment" value={value.design.align ?? "auto"} options={opts(ALIGNS, {})} resolved={auto(value.design.align, design.align)} onChange={(align) => setDesign({ align })} />
            )}
            <Choice
              label="Width"
              value={value.design.width ?? "auto"}
              options={opts(WIDTHS, { contained: "A narrower, centred measure", wide: "The page's content width", full: "Images run edge to edge (not beside a text column)" }).map((o) => ({ ...o, disabled: o.v === "full" && (side || nonMedia) }))}
              resolved={auto(value.design.width, design.width)}
              onChange={(width) => setDesign({ width })}
            />
            <Choice label="Spacing above" value={value.design.spacing ?? "auto"} options={opts(SPACINGS, {})} resolved={auto(value.design.spacing, design.spacing)} onChange={(spacing) => setDesign({ spacing })} />
            <Choice label="Background" value={value.design.tone ?? "base"} options={TONES.map((v) => ({ v, label: v === "base" ? "Page" : "Alternate band", hint: v === "base" ? "The page colours" : "The theme's second colour, full width (e.g. the cream bands)" }))} onChange={(tone) => setDesign({ tone })} />
            <Choice label="Edges" value={value.design.edge ?? "none"} options={EDGES.map((v) => ({ v, label: label(v), hint: v.startsWith("torn") ? "Torn-paper edge on the band" : v === "pattern" ? "The theme's pattern strip across the top" : "Straight" }))} onChange={(edge) => setDesign({ edge })} />
            <Choice label="Heading style" value={value.design.heading ?? "default"} options={HEADINGS.map((v) => ({ v, label: label(v), hint: HEADING_HINTS[v] }))} onChange={(heading) => setDesign({ heading })} />
            <Choice label="Chips" value={value.design.chips ?? "outline"} options={(["outline", "solid"] as const).map((v) => ({ v, label: label(v), hint: v === "outline" ? "Outlined pills" : "Solid pills in the page colour" }))} onChange={(chips) => setDesign({ chips })} />
            <Choice label="On phones" value={value.design.mobile ?? "auto"} options={opts(MOBILE_ORDERS, { "text-first": "Text, then media", "media-first": "Media, then text" })} resolved={auto(value.design.mobile, design.mobile)} onChange={(mobile) => setDesign({ mobile })} />
          </div>
        </details>
      </div>

      {(hasContent || textLength > 0) && (
        <div className="a-gallery-preview">
          <div className="a-gallery-bar">
            <b>Preview</b>
            <span className="a-hint">
              {cards ? `Cards · ${label(cardsPlan?.layout ?? "vertical")}` : nonMedia ? KIND_LABEL[kind] : plan ? label(plan.layout) : "Text only"} · text {label(placement).toLowerCase()}
            </span>
            <div className="a-seg">
              {(["desktop", "phone"] as const).map((d) => (
                <button key={d} type="button" aria-pressed={device === d} onClick={() => setDevice(d)}>
                  {d === "desktop" ? "Desktop" : "Phone"}
                </button>
              ))}
            </div>
          </div>
          <div className="a-pv-stage" data-device={device}>
            <Preview items={items} plan={plan} cards={cards ? value.cards : null} cardsPlan={cardsPlan} placement={placement} design={design} title={title} phone={device === "phone"} other={nonMedia && !cards ? <OtherPreview value={value} /> : undefined} />
          </div>
        </div>
      )}
    </div>
  );
}

const opts = <T extends string>(values: readonly T[], hints: Partial<Record<T, string>>): Opt<T>[] =>
  values.map((v) => ({ v, label: v === "auto" ? "Auto" : label(v), hint: hints[v] ?? (v === "auto" ? "Decided from your content" : label(v)) }));
const auto = (stored: string | undefined, resolved: string) => (!stored || stored === "auto" ? label(resolved) : undefined);

/* ---------------------------------------------------------- media editor */

function MediaEditor({ value, onChange, plan }: { value: SectionContent; onChange: (p: Partial<SectionContent>) => void; plan: GalleryPlan | null }) {
  const [picking, setPicking] = useState(false);
  const { items } = value;
  const setItem = (i: number, patch: Partial<GalleryItem>) => onChange({ items: items.map((it, j) => (j === i ? { ...it, ...patch } : it)) });
  const move = (i: number, d: -1 | 1) => {
    const j = i + d;
    if (j < 0 || j >= items.length) return;
    const next = [...items];
    [next[i], next[j]] = [next[j], next[i]];
    onChange({ items: next });
  };
  return (
    <>
      <div className="a-gallery-controls">
        <Choice
          label="Image layout"
          value={value.layout}
          options={LAYOUTS}
          resolved={value.layout === "auto" && plan ? label(plan.layout) : undefined}
          onChange={(layout) => onChange({ layout, columns: 0 })}
          icon={(v) => <LayoutIcon kind={v} />}
        />
        {plan && <SizeControl layout={plan.layout} value={value.columns} onChange={(columns) => onChange({ columns })} />}
      </div>
      <div className="a-gallery-items">
        <div className="a-gallery-bar">
          <b>
            {items.length} {items.length === 1 ? "image" : "images"}
          </b>
          <span className="a-hint">{items.length > 1 && plan?.layout === "collage" ? "★ puts an image in the big tile. " : ""}Order = reading order.</span>
          <button type="button" className="a-btn small" onClick={() => setPicking(true)}>
            + Add images
          </button>
        </div>
        {items.map((it, i) => (
          <div className="a-gallery-item" key={`${it.url}-${i}`}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {it.type === "video" ? <video src={it.url} muted preload="metadata" /> : <img src={it.sm || it.url} alt="" loading="lazy" />}
            <div className="a-gallery-fields">
              <input type="text" value={it.alt} placeholder="Alt text — describe the image" onChange={(e) => setItem(i, { alt: e.target.value })} aria-label={`Alt text for image ${i + 1}`} />
              <input type="text" value={it.caption ?? ""} placeholder="Caption (optional)" onChange={(e) => setItem(i, { caption: e.target.value })} aria-label={`Caption for image ${i + 1}`} />
            </div>
            <div className="a-gallery-act">
              <span className="a-hint">{it.w ? `${it.w}×${it.h}` : it.type}</span>
              {plan?.layout === "collage" && (
                <button
                  type="button"
                  className="a-btn small ghost"
                  aria-pressed={!!it.featured}
                  title="Put this image in the largest tile"
                  onClick={() => onChange({ items: items.map((x, j) => ({ ...x, featured: j === i ? !x.featured : false })) })}
                >
                  {it.featured ? "★" : "☆"}
                </button>
              )}
              <button type="button" className="a-btn small ghost" onClick={() => move(i, -1)} disabled={i === 0} aria-label="Move earlier">
                ↑
              </button>
              <button type="button" className="a-btn small ghost" onClick={() => move(i, 1)} disabled={i === items.length - 1} aria-label="Move later">
                ↓
              </button>
              <button type="button" className="a-btn small danger" onClick={() => onChange({ items: items.filter((_, j) => j !== i) })} aria-label="Remove image">
                ×
              </button>
            </div>
          </div>
        ))}
        {!items.length && <p className="a-empty">No images yet. Add one or more — the layout arranges itself.</p>}
      </div>
      <MediaPicker
        open={picking}
        multiple
        kind="any"
        onClose={() => setPicking(false)}
        onPickMany={(picked) => {
          onChange({ items: [...items, ...picked.map(toItem)].slice(0, 40) });
          setPicking(false);
        }}
      />
    </>
  );
}

/* ---------------------------------------------------------- cards editor */

function CardsEditor({ value, onChange, resolved }: { value: SectionContent; onChange: (p: Partial<SectionContent>) => void; resolved?: string }) {
  const { cards } = value;
  const setCard = (i: number, patch: Partial<Card>) => onChange({ cards: cards.map((c, j) => (j === i ? { ...c, ...patch } : c)) });
  const move = (i: number, d: -1 | 1) => {
    const j = i + d;
    if (j < 0 || j >= cards.length) return;
    const next = [...cards];
    [next[i], next[j]] = [next[j], next[i]];
    onChange({ cards: next });
  };
  return (
    <>
      <div className="a-gallery-controls">
        <Choice
          label="Card layout"
          value={value.cardLayout}
          options={CARD_OPTS.filter((o) => (CARD_LAYOUTS as readonly string[]).includes(o.v))}
          resolved={value.cardLayout === "auto" && resolved ? label(resolved) : undefined}
          onChange={(cardLayout) => onChange({ cardLayout })}
        />
      </div>
      <div className="a-gallery-items">
        <div className="a-gallery-bar">
          <b>
            {cards.length} {cards.length === 1 ? "card" : "cards"}
          </b>
          <span className="a-hint">Numbered automatically, in this order.</span>
          <button type="button" className="a-btn small" onClick={() => onChange({ cards: [...cards, { title: "", body: "", tag: "" }] })}>
            + Add card
          </button>
        </div>
        {cards.map((c, i) => (
          <div className="a-card-item" key={i}>
            <span className="a-card-num">{String(i + 1).padStart(2, "0")}</span>
            <div className="a-card-fields">
              <input type="text" value={c.title} placeholder="Title — e.g. Research & Folklore" onChange={(e) => setCard(i, { title: e.target.value })} aria-label={`Card ${i + 1} title`} />
              <textarea rows={2} value={c.body} placeholder="What happened in this step" onChange={(e) => setCard(i, { body: e.target.value })} aria-label={`Card ${i + 1} text`} />
              <input type="text" value={c.tag ?? ""} placeholder="Tag (optional) — e.g. Research → Cultural foundation" onChange={(e) => setCard(i, { tag: e.target.value })} aria-label={`Card ${i + 1} tag`} />
              {value.cardLayout === "path" && <ImageSlot label="Image (optional)" value={c.image ?? null} onChange={(image) => setCard(i, { image: image ?? undefined })} />}
            </div>
            <div className="a-gallery-act">
              <button type="button" className="a-btn small ghost" onClick={() => move(i, -1)} disabled={i === 0} aria-label="Move earlier">
                ↑
              </button>
              <button type="button" className="a-btn small ghost" onClick={() => move(i, 1)} disabled={i === cards.length - 1} aria-label="Move later">
                ↓
              </button>
              <button type="button" className="a-btn small danger" onClick={() => onChange({ cards: cards.filter((_, j) => j !== i) })} aria-label="Remove card">
                ×
              </button>
            </div>
          </div>
        ))}
        {!cards.length && <p className="a-empty">No cards yet. Add steps like Research → Concept → Core loop → Level design.</p>}
      </div>
    </>
  );
}

/* --------------------------------------------------------------- controls */

function Choice<T extends string>({
  label: title,
  value,
  options,
  resolved,
  onChange,
  icon,
}: {
  label: string;
  value: T;
  options: Opt<T>[];
  resolved?: string;
  onChange: (v: T) => void;
  icon?: (v: T) => ReactNode;
}) {
  const current = options.find((o) => o.v === value);
  return (
    <div className="a-field">
      <span>
        {title}
        {resolved && <em className="a-hint"> → {resolved}</em>}
      </span>
      <div className="a-seg wrap" role="radiogroup" aria-label={title}>
        {options.map((o) => (
          <button key={o.v} type="button" role="radio" aria-checked={o.v === value} aria-pressed={o.v === value} disabled={o.disabled} title={o.hint} onClick={() => onChange(o.v)}>
            {icon?.(o.v)}
            {o.label}
          </button>
        ))}
      </div>
      {current && current.hint !== current.label && <small className="a-hint">{current.hint}</small>}
    </div>
  );
}

function SizeControl({ layout, value, onChange }: { layout: ResolvedLayout; value: number; onChange: (n: number) => void }) {
  const o: [number, string][] | null =
    layout === "grid"
      ? [[0, "Auto"], [1, "1"], [2, "2"], [3, "3"], [4, "4"]]
      : layout === "rows"
        ? [[0, "Auto"], [1, "Large"], [2, "Medium"], [3, "Small"], [4, "Compact"]]
        : layout === "carousel"
          ? [[0, "Auto"], [1, "Large"], [2, "Medium"], [3, "Small"]]
          : null;
  if (!o) return null;
  const title = layout === "grid" ? "Columns" : layout === "rows" ? "Row height" : "Slide size";
  return (
    <div className="a-field">
      <span>{title}</span>
      <div className="a-seg" role="radiogroup" aria-label={title}>
        {o.map(([n, l]) => (
          <button key={n} type="button" role="radio" aria-checked={value === n} aria-pressed={value === n} onClick={() => onChange(n)}>
            {l}
          </button>
        ))}
      </div>
    </div>
  );
}

function LayoutIcon({ kind }: { kind: GalleryLayout }) {
  const r = (x: number, y: number, w: number, h: number, k: number) => <rect key={k} x={x} y={y} width={w} height={h} rx="1" />;
  const shapes: Record<GalleryLayout, ReactNode[]> = {
    auto: [r(1, 1, 7, 5, 0), r(9, 1, 6, 2, 1), r(9, 4, 6, 2, 2), r(1, 7, 14, 2, 3)],
    full: [r(1, 1, 14, 4, 0), r(1, 6, 14, 3, 1)],
    rows: [r(1, 1, 8, 4, 0), r(10, 1, 5, 4, 1), r(1, 6, 4, 3, 2), r(6, 6, 9, 3, 3)],
    grid: [r(1, 1, 4, 3, 0), r(6, 1, 4, 3, 1), r(11, 1, 4, 3, 2), r(1, 6, 4, 3, 3), r(6, 6, 4, 3, 4), r(11, 6, 4, 3, 5)],
    collage: [r(1, 1, 8, 8, 0), r(10, 1, 5, 4, 1), r(10, 6, 5, 3, 2)],
    carousel: [r(-2, 2, 4, 6, 0), r(3, 2, 10, 6, 1), r(14, 2, 4, 6, 2)],
  };
  return (
    <svg viewBox="0 0 16 10" width="20" height="13" aria-hidden="true" className="a-lay-ico">
      {shapes[kind]}
    </svg>
  );
}

/** tiny diagram of a composition preset: text lines (dark) + media blocks (light) */
function PresetIcon({ text, design }: { text: TextPlacement; design: SectionDesign }) {
  const m = (x: number, y: number, w: number, h: number) => <rect x={x} y={y} width={w} height={h} rx="1.5" className="m" />;
  const t = (x: number, y: number, w: number, k = 3) =>
    Array.from({ length: k }, (_, i) => <rect key={i} x={x} y={y + i * 2.4} width={i === k - 1 ? w * 0.6 : w} height="1.2" rx="0.6" className="t" />);
  let body: ReactNode;
  if (text === "left" || text === "right") {
    const even = design.split === "even";
    const tw = even ? 13 : 9;
    const tx = text === "left" ? 2 : 30 - tw;
    const mx = text === "left" ? tx + tw + 2 : 2;
    body = (
      <>
        {t(tx, design.valign === "center" ? 7 : 3, tw)}
        {m(mx, 2, 28 - tw - 2, 16)}
      </>
    );
  } else if (text === "overlay") body = (<>{m(0, 1, 32, 18)}{t(design.overlayPos === "center" ? 9 : 4, design.overlayPos === "center" ? 7 : 11, 14)}</>);
  else if (text === "inline") body = (<><rect x="2" y="2" width="8" height="7" rx="1.5" className="tt" />{m(12, 2, 18, 7)}{m(2, 11, 13, 7)}{m(17, 11, 13, 7)}</>);
  else if (text === "bottom") body = (<>{m(2, 1, 28, 11)}{t(2, 14, 20)}</>);
  else if (text === "top") body = design.align === "center" ? (<>{t(7, 2, 18)}{m(5, 10, 22, 9)}</>) : (<>{t(2, 2, 9, 2)}{t(13, 2, 17)}{m(2, 10, 28, 9)}</>);
  else body = (<>{m(2, 1, 17, 11)}{m(21, 1, 9, 11)}{t(2, 14, 26, 2)}</>);
  return (
    <svg viewBox="0 0 32 20" width="48" height="30" aria-hidden="true" className="a-preset-ico">
      {body}
    </svg>
  );
}

/* ---------------------------------------------------------------- preview */

/**
 * A scale model of the published section, drawn from the same plans the site
 * uses: image tiles (desktop placement or the phone 2-column version), cards,
 * and the resolved composition (placement, split, alignment, width, overlay).
 */
function Preview({
  items,
  plan,
  cards,
  cardsPlan,
  placement,
  design,
  title,
  phone,
  other,
}: {
  other?: ReactNode;
  items: GalleryItem[];
  plan: GalleryPlan | null;
  cards: Card[] | null;
  cardsPlan: CardsPlan | null;
  placement: string;
  design: ResolvedDesign;
  title: string;
  phone: boolean;
}) {
  const overlayText = placement === "overlay" && !phone;
  const textBlock = (variant: "plain" | "over" | "tile" = "plain") => (
    <div className={`a-pv-text ${variant}`} data-ovpos={variant === "over" ? design.overlayPos : undefined} data-ovstyle={variant === "over" ? design.overlayStyle : undefined}>
      <div className="inner">
        <b>{title || "Section heading"}</b>
        <i />
        <i />
        <i style={{ width: "62%" }} />
      </div>
    </div>
  );
  const img = (it: GalleryItem | undefined, style: CSSProperties = {}, over?: ReactNode) => (
    <div className="a-pv-img" style={{ ...style, backgroundImage: it && it.type === "image" ? `url("${it.sm || it.url}")` : undefined }} data-video={it?.type === "video" || undefined}>
      {over}
    </div>
  );

  let media: ReactNode = other ?? null;
  if (other) {
    // table / board / divider schematic
  } else if (cards && cardsPlan) {
    const horizontal = cardsPlan.layout === "horizontal" && !phone;
    media = (
      <div className="a-pv-cards" style={horizontal ? { gridTemplateColumns: `repeat(${cardsPlan.columns}, 1fr)` } : undefined} data-h={horizontal || undefined}>
        {cards.map((c, i) => (
          <div key={i} className="a-pv-card">
            <span>{String(i + 1).padStart(2, "0")}</span>
            <div>
              <b>{c.title || "Card title"}</b>
              <i />
              {c.tag && <em>{c.tag}</em>}
            </div>
          </div>
        ))}
      </div>
    );
  } else if (plan) {
    if (plan.layout === "full") {
      media = (
        <div className="a-pv-full">
          {items.slice(0, 3).map((it, i) => (
            <div key={i}>{img(it, { aspectRatio: String(fullRatio(ratioOf(it))) }, i === plan.hero && overlayText ? textBlock("over") : undefined)}</div>
          ))}
          {items.length > 3 && <span className="a-hint">+ {items.length - 3} more</span>}
        </div>
      );
    } else if (plan.layout === "rows") {
      const rh = (plan.rowHeight * (phone ? 0.5 : 1)) / 2.6;
      media = (
        <div className="a-pv-rows">
          {items.map((it, i) => {
            const r = ratioOf(it);
            return <div key={i} style={{ flex: `${r} 1 ${rh * r}px` }}>{img(it, { aspectRatio: String(r) })}</div>;
          })}
          {items.length > 3 && <i style={{ flex: "1000 1 0" }} />}
        </div>
      );
    } else if (plan.layout === "carousel") {
      media = (
        <div className="a-pv-carousel" style={{ height: phone ? 120 : plan.slide === "l" ? 170 : plan.slide === "s" ? 100 : 135 }}>
          {placement === "inline" && <div className="a-pv-slide-text">{textBlock("tile")}</div>}
          {items.map((it, i) => (
            <div key={i}>{img(it, { aspectRatio: String(Math.min(2.4, Math.max(0.56, ratioOf(it)))), height: "100%" })}</div>
          ))}
        </div>
      );
    } else {
      const collage = plan.layout === "collage";
      media = (
        <div
          className="a-pv-grid"
          style={
            phone
              ? { gridTemplateColumns: "1fr 1fr" }
              : { gridTemplateColumns: "repeat(12, 1fr)", ...(collage ? { gridTemplateRows: `repeat(${plan.rowsTotal}, 1fr)`, aspectRatio: `12 / ${plan.rowsTotal}` } : {}) }
          }
        >
          {plan.tiles.map((t, k) => {
            const place: CSSProperties = phone ? { gridColumn: t.wide ? "1 / -1" : "auto" } : { gridColumn: `${t.x + 1} / span ${t.w}`, gridRow: `${t.y + 1} / span ${t.h}` };
            if (t.i === -1)
              return (
                <div key={k} style={place} className="a-pv-tile-text">
                  {textBlock("tile")}
                </div>
              );
            const shape: CSSProperties = phone
              ? { aspectRatio: collage ? (t.wide ? "16 / 10" : "1") : String(t.wide ? plan.cell * 2 : plan.cell) }
              : collage
                ? { height: "100%" }
                : { aspectRatio: String(t.ratio) };
            return <div key={k} style={place}>{img(items[t.i], shape, t.i === plan.hero && overlayText ? textBlock("over") : undefined)}</div>;
          })}
        </div>
      );
    }
  }

  const side = (placement === "left" || placement === "right") && !phone;
  const showText = placement !== "inline" && !overlayText;
  // phones stack everything in the chosen order
  const textFirst = phone ? design.mobile === "text-first" : placement !== "bottom" && placement !== "right";
  const mediaNode = media && <div className="a-pv-media">{media}</div>;
  return (
    <div
      className="a-pv"
      data-side={side ? placement : undefined}
      data-split={side ? design.split : undefined}
      data-valign={side ? design.valign : undefined}
      data-align={design.align}
      data-width={design.width}
    >
      {textFirst ? (
        <>
          {showText && textBlock()}
          {mediaNode}
        </>
      ) : (
        <>
          {mediaNode}
          {showText && textBlock()}
        </>
      )}
    </div>
  );
}

/* ------------------------------------------------- single image slot */

function ImageSlot({ label: title, value, onChange }: { label: string; value: GalleryItem | null; onChange: (v: GalleryItem | null) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="a-slot">
      {value ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={value.sm || value.url} alt="" />
      ) : (
        <span className="a-slot-empty">{title}</span>
      )}
      <button type="button" className="a-btn small" onClick={() => setOpen(true)}>
        {value ? "Replace" : "Choose"}
      </button>
      {value && (
        <button type="button" className="a-btn small ghost" onClick={() => onChange(null)}>
          Remove
        </button>
      )}
      <MediaPicker
        open={open}
        kind="image"
        onClose={() => setOpen(false)}
        onPick={(m) => {
          onChange(toItem(m));
          setOpen(false);
        }}
      />
    </div>
  );
}

/* ------------------------------------------------------- table editor */

function TableEditor({ value, onChange }: { value: TableData; onChange: (t: TableData) => void }) {
  const [text, setText] = useState(() => tableToText(value.rows));
  useEffect(() => setText(tableToText(value.rows)), [value.rows]);
  const cols = value.rows.reduce((m, r) => Math.max(m, r.length), 0);
  return (
    <div className="a-gallery-controls">
      <div className="a-field">
        <span>
          Table <em className="a-hint">· {value.rows.length} rows × {cols} columns</em>
        </span>
        <textarea
          rows={8}
          value={text}
          placeholder={"Beat | Location | Player experience\n1. Start | Forest start point | Calm, unfamiliar"}
          onChange={(e) => setText(e.target.value)}
          onBlur={() => onChange({ ...value, rows: parseTable(text) })}
          style={{ fontFamily: "ui-monospace, monospace", fontSize: 12.5 }}
        />
        <small className="a-hint">One row per line, cells separated by | . Paste straight from a spreadsheet works too (tabs are converted).</small>
      </div>
      <label className="a-check">
        <input type="checkbox" checked={value.header} onChange={(e) => onChange({ ...value, header: e.target.checked })} />
        First row is the header
      </label>
    </div>
  );
}

/* ------------------------------------------------------- board editor */

function BoardEditor({ value, onChange }: { value: BoardData; onChange: (b: BoardData) => void }) {
  const setRef = (i: number, patch: Partial<BoardData["refs"][number]>) => onChange({ ...value, refs: value.refs.map((r, j) => (j === i ? { ...r, ...patch } : r)) });
  const [adding, setAdding] = useState(false);
  return (
    <div className="a-gallery-items">
      <div className="a-field">
        <span>Centre image (e.g. a map)</span>
        <ImageSlot label="Centre image" value={value.center} onChange={(center) => onChange({ ...value, center })} />
      </div>
      <div className="a-gallery-bar" style={{ marginTop: 12 }}>
        <b>{value.refs.length} reference sheets</b>
        <span className="a-hint">Joined to the centre by dashed lines that draw as you scroll.</span>
        <button type="button" className="a-btn small" onClick={() => setAdding(true)}>
          + Add sheet
        </button>
      </div>
      {value.refs.map((r, i) => (
        <div className="a-gallery-item" key={i}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={r.image.sm || r.image.url} alt="" />
          <div className="a-gallery-fields">
            <input type="text" value={r.label} placeholder="Label — e.g. Cave references" onChange={(e) => setRef(i, { label: e.target.value })} />
            <select value={r.side} onChange={(e) => setRef(i, { side: e.target.value as "left" | "right" })}>
              <option value="left">Left side</option>
              <option value="right">Right side</option>
            </select>
          </div>
          <div className="a-gallery-act">
            <button type="button" className="a-btn small danger" onClick={() => onChange({ ...value, refs: value.refs.filter((_, j) => j !== i) })} aria-label="Remove sheet">
              ×
            </button>
          </div>
        </div>
      ))}
      <MediaPicker
        open={adding}
        multiple
        kind="image"
        onClose={() => setAdding(false)}
        onPickMany={(picked) => {
          const start = value.refs.length;
          onChange({ ...value, refs: [...value.refs, ...picked.map((m, k) => ({ label: "", image: toItem(m), side: ((start + k) % 2 ? "right" : "left") as "left" | "right" }))].slice(0, 8) });
          setAdding(false);
        }}
      />
    </div>
  );
}

/* ------------------------------------- subtitle, chips, ornaments */

function ExtrasEditor({ value, onChange }: { value: SectionContent; onChange: (p: Partial<SectionContent>) => void }) {
  const [chipText, setChipText] = useState(() => value.chips.join("\n"));
  const [adding, setAdding] = useState(false);
  const setOrn = (i: number, patch: Partial<Ornament>) => onChange({ ornaments: value.ornaments.map((o, j) => (j === i ? { ...o, ...patch } : o)) });
  return (
    <details className="a-fine">
      <summary>Subtitle, chips and ornaments</summary>
      <div className="a-gallery-controls">
        <div className="a-field">
          <span>Subtitle</span>
          <input type="text" value={value.subtitle} placeholder="Small line under the heading — e.g. Design Process" onChange={(e) => onChange({ subtitle: e.target.value })} />
        </div>
        <div className="a-field">
          <span>Chips</span>
          <textarea
            rows={2}
            value={chipText}
            placeholder={"Story → Character → Theme"}
            onChange={(e) => setChipText(e.target.value)}
            onBlur={() => onChange({ chips: chipText.split("\n").map((c) => c.trim()).filter(Boolean).slice(0, 6) })}
          />
          <small className="a-hint">One chip per line. Shown as pills after the text.</small>
        </div>
        <div className="a-field">
          <span>Ornaments</span>
          {value.ornaments.map((o, i) => (
            <div className="a-orn-row" key={i}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={o.url} alt="" />
              <select value={o.side} onChange={(e) => setOrn(i, { side: e.target.value as "left" | "right" })} aria-label="Side">
                <option value="left">Left edge</option>
                <option value="right">Right edge</option>
              </select>
              <label>
                Top %<input type="number" value={o.top} min={-20} max={120} onChange={(e) => setOrn(i, { top: Number(e.target.value) })} />
              </label>
              <label>
                Width<input type="number" value={o.width} min={20} max={1200} onChange={(e) => setOrn(i, { width: Number(e.target.value) })} />
              </label>
              <label className="a-check">
                <input type="checkbox" checked={!!o.spin} onChange={(e) => setOrn(i, { spin: e.target.checked })} />
                Spin
              </label>
              <label className="a-check">
                <input type="checkbox" checked={!!o.flip} onChange={(e) => setOrn(i, { flip: e.target.checked })} />
                Mirror
              </label>
              <button type="button" className="a-btn small danger" onClick={() => onChange({ ornaments: value.ornaments.filter((_, j) => j !== i) })} aria-label="Remove ornament">
                ×
              </button>
            </div>
          ))}
          <button type="button" className="a-btn small" style={{ justifySelf: "start" }} onClick={() => setAdding(true)}>
            + Add ornament
          </button>
          <small className="a-hint">Decorative art pinned to the page edge (SVG or PNG). Width is in pixels on a 1440px-wide screen and scales with the screen.</small>
        </div>
      </div>
      <MediaPicker
        open={adding}
        kind="image"
        onClose={() => setAdding(false)}
        onPick={(m) => {
          onChange({ ornaments: [...value.ornaments, { url: m.url, side: "left" as const, top: 10, width: 200 }].slice(0, 8) });
          setAdding(false);
        }}
      />
    </details>
  );
}

/** schematic for table / board / divider sections */
function OtherPreview({ value }: { value: SectionContent }) {
  if (value.kind === "table")
    return (
      <div className="a-pv-table">
        {value.table.rows.slice(0, 6).map((r, i) => (
          <div key={i} style={{ gridTemplateColumns: `repeat(${Math.max(1, r.length)}, 1fr)` }} data-head={(i === 0 && value.table.header) || undefined}>
            {r.map((c, j) => (
              <span key={j}>{c}</span>
            ))}
          </div>
        ))}
        {value.table.rows.length > 6 && <span className="a-hint">+ {value.table.rows.length - 6} more rows</span>}
      </div>
    );
  if (value.kind === "board")
    return (
      <div className="a-pv-board">
        <div>{value.board.refs.filter((r) => r.side === "left").map((r, i) => <i key={i} style={{ backgroundImage: `url("${r.image.sm || r.image.url}")` }} />)}</div>
        <b style={{ backgroundImage: value.board.center ? `url("${value.board.center.sm || value.board.center.url}")` : undefined }} />
        <div>{value.board.refs.filter((r) => r.side === "right").map((r, i) => <i key={i} style={{ backgroundImage: `url("${r.image.sm || r.image.url}")` }} />)}</div>
      </div>
    );
  return <div className="a-pv-divider">{value.divider === "footprints" ? "· · ·  footprints trail  · · ·" : value.divider === "pattern" ? "▦ ▦ ▦ pattern band ▦ ▦ ▦" : "———"}</div>;
}
