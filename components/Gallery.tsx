"use client";

import Image from "next/image";
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { fullRatio, ratioOf, tileSizes, type GalleryItem, type GalleryPlan, type Tile } from "@/lib/gallery";

/**
 * Renders an image section from a plan made on the server (lib/gallery.ts).
 * Pure CSS layout: grid / collage place tiles on a 12-column grid, rows use
 * flex-grow = aspect ratio (justified, uncropped), the carousel is a native
 * scroll-snap track. Every tile reserves its space (aspect-ratio) before the
 * image arrives, so nothing jumps; a 480px preview shows while it loads.
 */
export function Gallery({
  items,
  plan,
  label,
  overlay,
  inline,
  side = false,
}: {
  items: GalleryItem[];
  plan: GalleryPlan;
  label: string;
  /** text drawn over the hero image */
  overlay?: ReactNode;
  /** text drawn as a tile inside the layout */
  inline?: ReactNode;
  /** text sits in a column beside the images (affects image sizes) */
  side?: boolean;
}) {
  if (plan.layout === "carousel") return <Carousel items={items} plan={plan} label={label} inline={inline} side={side} />;

  if (plan.layout === "full")
    return (
      <div className="g g-full">
        {items.map((it, i) => (
          <Figure key={i} item={it} i={i} ratio={fullRatio(ratioOf(it))} sizes={tileSizes(plan, undefined, side)} parallax overlay={i === plan.hero ? overlay : undefined} />
        ))}
      </div>
    );

  if (plan.layout === "rows")
    return (
      <div className="g g-rows" style={{ "--rh": `${plan.rowHeight}px` } as CSSProperties}>
        {items.map((it, i) => {
          const r = ratioOf(it);
          return (
            <Figure key={i} item={it} i={i} ratio={r} sizes={tileSizes(plan, undefined, side)} style={{ flexGrow: r, flexBasis: `calc(var(--rh) * var(--rs, 1) * ${r.toFixed(3)})` }} />
          );
        })}
        {/* several rows: keep a short last row from blowing up (one row always fills the width) */}
        {items.length > 3 && <i className="g-fill" aria-hidden="true" />}
      </div>
    );

  // grid + collage: explicit placement on 12 columns
  return (
    <div className={`g g-${plan.layout}`}>
      <div className="g-tiles" style={{ "--rows": plan.rowsTotal, "--cell": plan.cell || 1.5 } as CSSProperties}>
        {plan.tiles.map((t, k) =>
          t.i === -1 ? (
            <div key="text" className="g-text-tile" style={place(t)} data-wide={t.wide || undefined}>
              {inline}
            </div>
          ) : (
            <Figure
              key={k}
              item={items[t.i]}
              i={k}
              ratio={t.ratio}
              sizes={tileSizes(plan, t, side)}
              style={place(t)}
              wide={t.wide}
              overlay={t.i === plan.hero ? overlay : undefined}
            />
          ),
        )}
      </div>
    </div>
  );
}

const place = (t: Tile): CSSProperties => ({ gridColumn: `${t.x + 1} / span ${t.w}`, gridRow: `${t.y + 1} / span ${t.h}` });

function Figure({
  item,
  i,
  ratio,
  sizes,
  style,
  wide,
  parallax = false,
  overlay,
  className = "",
}: {
  item: GalleryItem;
  i: number;
  ratio: number;
  sizes: string;
  style?: CSSProperties;
  wide?: boolean;
  parallax?: boolean;
  overlay?: ReactNode;
  className?: string;
}) {
  const media =
    item.type === "video" ? (
      <video data-autoplay src={item.url} muted loop playsInline preload="none" aria-label={item.alt} />
    ) : (
      <Image src={item.url} alt={item.alt} fill sizes={sizes} />
    );
  return (
    <figure
      className={`cs-media g-tile ${className}`}
      data-reveal
      data-wide={wide || undefined}
      data-overlay={overlay ? "" : undefined}
      style={{ ...style, "--r": ratio.toFixed(4), "--i": Math.min(i, 8) } as CSSProperties}
    >
      <div className="cs-frame" style={item.sm ? { backgroundImage: `url("${item.sm}")` } : undefined}>
        {parallax && item.type === "image" ? (
          <div className="cs-parallax" data-parallax>
            {media}
          </div>
        ) : (
          media
        )}
      </div>
      {overlay ? (
        // text over the image; on phones it drops below the image (CSS)
        <div className="g-over">
          {overlay}
          {item.caption && <figcaption>{item.caption}</figcaption>}
        </div>
      ) : (
        item.caption && <figcaption>{item.caption}</figcaption>
      )}
    </figure>
  );
}

/* -------------------------------------------------------------- carousel */

function Carousel({ items, plan, label, inline, side }: { items: GalleryItem[]; plan: GalleryPlan; label: string; inline?: ReactNode; side: boolean }) {
  const track = useRef<HTMLDivElement>(null);
  const [at, setAt] = useState(0);
  const [ends, setEnds] = useState({ start: true, end: false });
  const count = items.length + (inline ? 1 : 0);

  useEffect(() => {
    const el = track.current;
    if (!el) return;
    let raf = 0;
    const update = () => {
      raf = 0;
      const slides = Array.from(el.children) as HTMLElement[];
      const x = el.scrollLeft + 1;
      let n = 0;
      for (let k = 0; k < slides.length; k++) if (slides[k].offsetLeft - slides[0].offsetLeft <= x) n = k;
      setAt(n);
      setEnds({ start: el.scrollLeft < 4, end: el.scrollLeft + el.clientWidth >= el.scrollWidth - 4 });
    };
    const onScroll = () => (raf ||= requestAnimationFrame(update));
    el.addEventListener("scroll", onScroll, { passive: true });
    update();

    // drag with a mouse (touch and trackpads scroll natively)
    let down = false;
    let startX = 0;
    let startLeft = 0;
    const onDown = (e: PointerEvent) => {
      if (e.pointerType !== "mouse" || e.button !== 0) return;
      down = true;
      startX = e.clientX;
      startLeft = el.scrollLeft;
      el.dataset.drag = "";
    };
    const onMove = (e: PointerEvent) => {
      if (!down) return;
      el.scrollLeft = startLeft - (e.clientX - startX);
    };
    const onUp = () => {
      if (!down) return;
      down = false;
      delete el.dataset.drag; // snapping resumes and settles on the nearest slide
    };
    el.addEventListener("pointerdown", onDown);
    addEventListener("pointermove", onMove);
    addEventListener("pointerup", onUp);
    return () => {
      cancelAnimationFrame(raf);
      el.removeEventListener("scroll", onScroll);
      el.removeEventListener("pointerdown", onDown);
      removeEventListener("pointermove", onMove);
      removeEventListener("pointerup", onUp);
    };
  }, []);

  const go = (d: 1 | -1) => {
    const el = track.current;
    if (!el) return;
    const slides = Array.from(el.children) as HTMLElement[];
    const target = slides[Math.max(0, Math.min(slides.length - 1, at + d))];
    const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollTo({ left: target.offsetLeft - slides[0].offsetLeft, behavior: reduced ? "auto" : "smooth" });
  };

  return (
    <div className="g g-carousel" data-size={plan.slide} role="region" aria-roledescription="carousel" aria-label={label}>
      <div className="g-track" ref={track} tabIndex={0} onDragStart={(e) => e.preventDefault()}>
        {inline && <div className="g-slide g-text-tile">{inline}</div>}
        {items.map((it, i) => (
          <Figure
            key={i}
            item={it}
            i={i}
            className="g-slide"
            ratio={Math.min(2.4, Math.max(0.56, ratioOf(it)))}
            sizes={tileSizes(plan, undefined, side)}
          />
        ))}
      </div>
      {count > 1 && (
        <div className="g-ctrl">
          <button type="button" onClick={() => go(-1)} disabled={ends.start} aria-label="Previous image">
            ←
          </button>
          <span aria-live="polite">
            {String(at + 1).padStart(2, "0")} / {String(count).padStart(2, "0")}
          </span>
          <button type="button" onClick={() => go(1)} disabled={ends.end} aria-label="Next image">
            →
          </button>
        </div>
      )}
    </div>
  );
}
