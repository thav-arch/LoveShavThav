"use client";

import Image from "next/image";
import { useEffect, useId, useRef, useState, type CSSProperties } from "react";
import type { Card, CardsPlan } from "@/lib/cards";
import { ratioOf } from "@/lib/gallery";

const pad = (n: number) => String(n).padStart(2, "0");

/**
 * Card sections (lib/cards.ts).
 *   vertical / horizontal  numbered step cards joined by a connector line
 *   path                   steps along a winding dashed path that draws as you scroll
 *   range                  start ··· note ··· end (e.g. Draft 1 → Draft 8)
 * Revealed on scroll; phones get a single column.
 */
export function Cards({ items, plan }: { items: Card[]; plan: CardsPlan }) {
  if (plan.layout === "path") return <PathCards items={items} />;
  if (plan.layout === "range") return <RangeCards items={items} />;
  return (
    <ol className="cc" data-layout={plan.layout} style={{ "--cols": plan.columns } as CSSProperties}>
      {items.map((c, i) => (
        <li key={i} className="cc-card" data-reveal style={{ "--i": Math.min(i, 8) } as CSSProperties}>
          <span className="cc-num" aria-hidden="true">
            {pad(i + 1)}
          </span>
          <div className="cc-body">
            <h3>{c.title}</h3>
            {c.body && <p>{c.body}</p>}
            {c.tag && <span className="cc-tag">{c.tag}</span>}
          </div>
        </li>
      ))}
    </ol>
  );
}

/* ------------------------------------------------------------------ path */

/**
 * A meandering dashed path through each step's node. It is computed from the
 * nodes' real positions (so it fits any width) and revealed with a mask whose
 * length follows --p, the section's scroll progress (useEditorialScroll).
 */
function PathCards({ items }: { items: Card[] }) {
  const root = useRef<HTMLOListElement>(null);
  const maskId = `cp-${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  const [geo, setGeo] = useState<{ w: number; h: number; d: string; len: number } | null>(null);

  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const measure = () => {
      const box = el.getBoundingClientRect();
      const steps = Array.from(el.querySelectorAll<HTMLElement>(".cp-step"));
      const nodes = steps.map((s) => {
        // layout position (offsetLeft/Top) — not the reveal's slide-in transform
        const sr = s.getBoundingClientRect();
        const at = (q: DOMRect) => ({ x: s.offsetLeft + q.left - sr.left, y: s.offsetTop + q.top - sr.top });
        const nr = s.querySelector(".cp-node")!.getBoundingClientRect();
        const n = at(nr);
        // how far the step's text and image reach to each side
        let l = n.x, r = n.x + nr.width;
        for (const c of Array.from(s.children)) {
          const cr = c.getBoundingClientRect();
          l = Math.min(l, at(cr).x);
          r = Math.max(r, at(cr).x + cr.width);
        }
        return { x: n.x + nr.width / 2, y: n.y + nr.height / 2, l, r };
      });
      if (nodes.length < 2) return setGeo(null);
      const w = box.width;
      // like a forest trail: leave each node sideways, run down the margin
      // beside the text (alternating sides), then come back in to the next node
      // — the line never crosses the words or pictures
      let d = `M ${nodes[0].x} ${nodes[0].y}`;
      for (let i = 1; i < nodes.length; i++) {
        const a = nodes[i - 1];
        const b = nodes[i];
        const side = w < 700 ? -1 : i % 2 ? 1 : -1; // phones: always the left margin
        const gap = w < 700 ? 10 : Math.min(48, w * 0.03);
        const edge = side > 0 ? Math.max(a.r, b.r) + gap : Math.min(a.l, b.l) - gap;
        const x = Math.min(w + 24, Math.max(-24, edge));
        const r = Math.min(120, (b.y - a.y) / 3);
        d +=
          ` C ${(a.x + x) / 2} ${a.y}, ${x} ${a.y}, ${x} ${a.y + r}` +
          ` L ${x} ${b.y - r}` +
          ` C ${x} ${b.y}, ${(b.x + x) / 2} ${b.y}, ${b.x} ${b.y}`;
      }
      const probe = document.createElementNS("http://www.w3.org/2000/svg", "path");
      probe.setAttribute("d", d);
      setGeo({ w, h: box.height, d, len: Math.ceil(probe.getTotalLength()) });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [items.length]);

  return (
    <ol className="cp" ref={root} data-progress>
      {geo && (
        <svg className="cp-line" width={geo.w} height={geo.h} viewBox={`0 0 ${geo.w} ${geo.h}`} aria-hidden="true">
          <defs>
            <mask id={maskId} maskUnits="userSpaceOnUse">
              <path d={geo.d} stroke="#fff" strokeWidth="8" fill="none" style={{ strokeDasharray: geo.len, strokeDashoffset: `calc(${geo.len}px * (1 - var(--p, 0) * 1.25))` }} />
            </mask>
          </defs>
          <path d={geo.d} className="cp-dash" mask={`url(#${maskId})`} />
        </svg>
      )}
      {items.map((c, i) => (
        <li key={i} className="cp-step" data-reveal style={{ "--i": Math.min(i, 8) } as CSSProperties}>
          <span className="cp-node" aria-hidden="true" />
          <h3>{c.title}</h3>
          {c.body && <p>{c.body}</p>}
          {c.image && (
            <figure className="cp-media cs-media" data-reveal>
              <div className="cs-frame" style={{ aspectRatio: String(ratioOf(c.image)), backgroundImage: c.image.sm ? `url("${c.image.sm}")` : undefined }}>
                <Image src={c.image.url} alt={c.image.alt} fill sizes="(max-width: 900px) 100vw, 80vw" />
              </div>
            </figure>
          )}
          {c.tag && <span className="chip">{c.tag}</span>}
        </li>
      ))}
    </ol>
  );
}

/* ----------------------------------------------------------------- range */

function RangeCards({ items }: { items: Card[] }) {
  const first = items[0];
  const last = items.length > 1 ? items[items.length - 1] : undefined;
  const middle = items.slice(1, -1);
  return (
    <div className="cr" data-reveal>
      <div className="cr-end">
        <h3>{first.title}</h3>
        {first.body && <p>{first.body}</p>}
      </div>
      <div className="cr-mid" aria-hidden={middle.length ? undefined : true}>
        <span className="cr-dot" />
        {middle.map((m, i) => (
          <p key={i}>{[m.title, m.body].filter(Boolean).join(" — ")}</p>
        ))}
      </div>
      {last && (
        <div className="cr-end cr-last">
          <h3>{last.title}</h3>
          {last.body && <p>{last.body}</p>}
        </div>
      )}
    </div>
  );
}
