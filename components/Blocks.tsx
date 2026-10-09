"use client";

import Image from "next/image";
import { useEffect, useId, useRef, useState, type CSSProperties, type ReactNode } from "react";
import type { BoardData, DividerStyle, HeadingStyle, Ornament, TableData } from "@/lib/blocks";
import { ratioOf, type GalleryItem } from "@/lib/gallery";

/**
 * Case-study building blocks beyond images and cards (lib/blocks.ts).
 * Scroll-linked animation reads --p, the block's scroll progress 0→1, which
 * useEditorialScroll writes onto every [data-progress] element — so drawing
 * a line or stepping footprints is plain CSS, no per-block scroll code.
 */

const pad = (n: number) => String(n).padStart(2, "0");

/* --------------------------------------------------------------- heading */

export function SectionHeading({ style, n, title, subtitle }: { style: HeadingStyle; n: number; title: string; subtitle?: string }) {
  if (style === "hidden") return <h2 className="sr-only">{title}</h2>;
  if (style === "default")
    return (
      <div className="cs-section-head" data-reveal>
        <span className="cs-num">{pad(n + 1)}</span>
        <div>
          <h2>{title}</h2>
          {subtitle && <p className="csx-sub">{subtitle}</p>}
        </div>
      </div>
    );
  return (
    <div className="cs-section-head csx-head" data-head={style} data-reveal>
      {style === "rules" && <i className="csx-rule" aria-hidden="true" />}
      <div className="csx-head-text">
        <h2>{title}</h2>
        {subtitle && <p className="csx-sub">{subtitle}</p>}
      </div>
      {style === "rules" && <i className="csx-rule" aria-hidden="true" />}
      {style === "dashed" && <i className="csx-dash" aria-hidden="true" />}
      {style === "ornament" && (
        <span className="csx-orn-rule" aria-hidden="true">
          <i />
          <svg viewBox="0 0 24 24" width="22" height="22">
            <path d="M12 0 C13 8 16 11 24 12 C16 13 13 16 12 24 C11 16 8 13 0 12 C8 11 11 8 12 0Z" fill="currentColor" />
          </svg>
          <i />
        </span>
      )}
    </div>
  );
}

/* ----------------------------------------------------------------- chips */

export function Chips({ chips }: { chips: string[] }) {
  return (
    <ul className="csx-chips" data-reveal>
      {chips.map((c, i) => (
        <li key={i} className="chip">
          {c}
        </li>
      ))}
    </ul>
  );
}

/* ------------------------------------------------------------- ornaments */

/** decorative art pinned to the page edges, drifting gently with the scroll */
export function Ornaments({ items }: { items: Ornament[] }) {
  return (
    <div className="csx-orns" aria-hidden="true">
      {items.map((o, i) => (
        <span
          key={i}
          className="csx-orn"
          data-side={o.side}
          data-spin={o.spin || undefined}
          data-drift
          style={{ top: `${o.top}%`, "--w": o.width, "--flip": o.flip ? -1 : 1 } as CSSProperties}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={o.url} alt="" loading="lazy" decoding="async" />
        </span>
      ))}
    </div>
  );
}

/* ----------------------------------------------------------------- table */

export function TableBlock({ table, label }: { table: TableData; label: string }) {
  const [head, ...rows] = table.header ? table.rows : [null, ...table.rows];
  return (
    <div className="csx-table-wrap" data-reveal tabIndex={0} role="region" aria-label={label}>
      <table className="csx-table">
        {head && (
          <thead>
            <tr>
              {head.map((c, i) => (
                <th key={i} scope="col">
                  {c}
                </th>
              ))}
            </tr>
          </thead>
        )}
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} style={{ "--i": Math.min(i, 14) } as CSSProperties}>
              {r!.map((c, j) => (j === 0 ? <th key={j} scope="row">{c}</th> : <td key={j}>{c}</td>))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ----------------------------------------------------------------- board */

function BoardImage({ item, sizes, className = "" }: { item: GalleryItem; sizes: string; className?: string }) {
  return (
    <div className={`csx-board-img ${className}`} style={{ aspectRatio: String(ratioOf(item)), backgroundImage: item.sm ? `url("${item.sm}")` : undefined }}>
      <Image src={item.url} alt={item.alt} fill sizes={sizes} />
    </div>
  );
}

/**
 * Reference board: a centre image with labelled reference sheets on both
 * sides, joined by dashed connectors measured from the real layout.
 */
export function Board({ board }: { board: BoardData }) {
  const root = useRef<HTMLDivElement>(null);
  const maskId = `bd-${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  const [geo, setGeo] = useState<{ w: number; h: number; paths: string[]; len: number } | null>(null);
  const left = board.refs.filter((r) => r.side === "left");
  const right = board.refs.filter((r) => r.side === "right");

  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const measure = () => {
      const box = el.getBoundingClientRect();
      const center = el.querySelector<HTMLElement>(".csx-board-center");
      if (!center || box.width < 860) return setGeo(null); // stacked on small screens: no connectors
      const c = center.getBoundingClientRect();
      const paths: string[] = [];
      el.querySelectorAll<HTMLElement>(".csx-board-ref").forEach((ref, k) => {
        const r = ref.getBoundingClientRect();
        const isLeft = ref.dataset.side === "left";
        const x1 = (isLeft ? r.right : r.left) - box.left + (isLeft ? 10 : -10);
        const y1 = r.top - box.top + r.height * 0.42;
        const x2 = (isLeft ? c.left : c.right) - box.left + (isLeft ? -8 : 8);
        const y2 = c.top - box.top + c.height * (0.3 + 0.35 * (k % 2));
        const mx = (x1 + x2) / 2;
        paths.push(`M ${x1} ${y1} C ${mx} ${y1}, ${mx} ${y2}, ${x2} ${y2}`);
      });
      setGeo({ w: box.width, h: box.height, paths, len: 900 });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [board.refs.length]);

  const ref = (r: BoardData["refs"][number], i: number) => (
    <figure key={i} className="csx-board-ref" data-side={r.side} data-reveal style={{ "--i": i } as CSSProperties}>
      <BoardImage item={r.image} sizes="(max-width: 860px) 100vw, 28vw" />
      {r.label && <figcaption>{r.label}</figcaption>}
    </figure>
  );

  return (
    <div className="csx-board" ref={root} data-progress>
      {geo && (
        <svg className="csx-board-lines" width={geo.w} height={geo.h} viewBox={`0 0 ${geo.w} ${geo.h}`} aria-hidden="true">
          <defs>
            <mask id={maskId} maskUnits="userSpaceOnUse">
              {geo.paths.map((d, i) => (
                <path key={i} d={d} stroke="#fff" strokeWidth="8" fill="none" style={{ strokeDasharray: geo.len, strokeDashoffset: `calc(${geo.len}px * (1 - var(--p, 0) * 1.6))` }} />
              ))}
            </mask>
          </defs>
          <g mask={`url(#${maskId})`}>
            {geo.paths.map((d, i) => (
              <path key={i} d={d} className="csx-board-dash" />
            ))}
          </g>
        </svg>
      )}
      <div className="csx-board-col" data-col="left">{left.map(ref)}</div>
      {board.center && (
        <figure className="csx-board-center" data-reveal>
          <BoardImage item={board.center} sizes="(max-width: 860px) 100vw, 36vw" />
        </figure>
      )}
      <div className="csx-board-col" data-col="right">{right.map((r, i) => ref(r, i + left.length))}</div>
    </div>
  );
}

/* --------------------------------------------------------------- divider */

/** one footprint (traced from the Songs of Saaja design) */
function Foot() {
  return (
    <g>
      <path d="M18.27 28.17 18.07 18.41 38.52 8.58C40.89 9.12 45.86 10.78 46.74 13.1 47.62 15.43 45.17 15.59 43.83 15.38L39.95 18.41C37.66 19.98 32.75 23.49 31.46 25.05 30.17 26.6 32.36 31.87 33.62 34.31L27.4 39.85 18.27 28.17Z" />
      <ellipse cx="11.55" cy="21.56" rx="1.53" ry="2.45" transform="rotate(-128 11.55 21.56)" />
      <ellipse cx="12.58" cy="27.35" rx="1.84" ry="2.75" transform="rotate(-128 12.58 27.35)" />
      <ellipse cx="13.38" cy="33.34" rx="2.14" ry="3.37" transform="rotate(-128 13.38 33.34)" />
      <ellipse cx="16.37" cy="39.15" rx="2.45" ry="3.98" transform="rotate(-128 16.37 39.15)" />
      <ellipse cx="19.74" cy="45.45" rx="3.37" ry="5.2" transform="rotate(-128 19.74 45.45)" />
    </g>
  );
}

const TRAILS = ["M 140 0 C 140 170 560 150 712 292", "M 1300 0 C 1300 170 880 150 728 292", "M 760 40 C 760 150 730 210 720 292"];

/** footprints walking down branching trails into the next section */
function Footprints() {
  const [steps, setSteps] = useState<{ x: number; y: number; a: number }[]>([]);
  useEffect(() => {
    const out: { x: number; y: number; a: number }[] = [];
    TRAILS.forEach((d, t) => {
      const p = document.createElementNS("http://www.w3.org/2000/svg", "path");
      p.setAttribute("d", d);
      const len = p.getTotalLength();
      const n = t === 2 ? 3 : 6;
      for (let i = 0; i < n; i++) {
        const at = ((i + 0.7) / (n + 0.4)) * len;
        const q = p.getPointAtLength(at);
        const q2 = p.getPointAtLength(Math.min(len, at + 2));
        const ang = (Math.atan2(q2.y - q.y, q2.x - q.x) * 180) / Math.PI;
        const side = i % 2 ? 1 : -1; // alternate left / right foot
        const nx = -(q2.y - q.y) / 2;
        const ny = (q2.x - q.x) / 2;
        out.push({ x: q.x + nx * side * 9, y: q.y + ny * side * 9, a: ang });
      }
    });
    out.sort((a, b) => a.y - b.y); // appear from the top down
    setSteps(out);
  }, []);
  return (
    <div className="csx-feet" data-progress>
      <svg viewBox="0 0 1440 310" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
        {TRAILS.map((d, i) => (
          <path key={i} d={d} className="csx-trail" />
        ))}
        {steps.map((s, i) => (
          <g
            key={i}
            className="csx-foot"
            style={{ "--i": i, "--n": steps.length } as CSSProperties}
            transform={`translate(${s.x} ${s.y}) rotate(${s.a - 90}) translate(-28 -26)`}
          >
            <Foot />
          </g>
        ))}
        <circle cx="720" cy="298" r="9" className="csx-trail-end" />
      </svg>
    </div>
  );
}

export function Divider({ style, band }: { style: DividerStyle; band?: string }) {
  if (style === "footprints") return <Footprints />;
  if (style === "pattern" && band) return <div className="csx-band" style={{ backgroundImage: `url("${band}")` }} aria-hidden="true" />;
  return <hr className="csx-hr" />;
}

/* ------------------------------------------------------------ highlights */

/** ==text== / ^^text^^ highlights for plain-text fields (e.g. the summary) */
export function Highlighted({ text }: { text: string }): ReactNode {
  const parts = text.split(/(==[^=]+==|\^\^[^^]+\^\^)/g);
  return parts.map((p, i) =>
    p.startsWith("==") && p.endsWith("==") ? (
      <mark key={i} className="hl">
        {p.slice(2, -2)}
      </mark>
    ) : p.startsWith("^^") && p.endsWith("^^") ? (
      <mark key={i} className="hl2">
        {p.slice(2, -2)}
      </mark>
    ) : (
      p
    ),
  );
}
