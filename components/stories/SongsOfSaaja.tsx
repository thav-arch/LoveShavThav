"use client";

import Image from "next/image";
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import type { Project } from "@/lib/project-types";
import { Highlighted } from "../Blocks";
import "./SongsOfSaaja.css";

/**
 * Songs of Saaja — a one-to-one build of the Figma frame "Songs of Saaja"
 * (node 89:20318, 1440 × 14275). On wide screens every element sits at its
 * Figma position on a 1440-unit grid that scales with the window
 * (1 unit = 100cqw / 1440), so the composition stays exactly as designed at
 * any desktop size. Below 1024px the same elements fall into a single readable
 * column (see "phones" in SongsOfSaaja.css). Art and photos are web-optimised
 * exports of the frame in /public/projects/saaja-story.
 *
 * Motion layer: smooth scrolling, reveals and image parallax come from the
 * case-study page (useEditorialScroll). This component adds the Gond-art strip
 * that pans sideways, the journey line and the forest / cave outlines drawing
 * themselves, the scroll-drawn progress trail through the design process with
 * nodes that light up, connectors, footprints that walk, the Draft 1 → 8 line,
 * beat charts linked to the level maps, and the Bana progression.
 */

const A = "/projects/saaja-story/";
type V = CSSProperties & Record<`--${string}`, string | number>;

/** absolute box in frame units: x, y (frame px), w, h */
const at = (x: number, y: number, w?: number, h?: number, extra: V = {}): V => ({
  "--x": x,
  "--y": y,
  ...(w != null && { "--w": w }),
  ...(h != null && { "--hh": `calc(${h} * var(--u))`, "--ar": `${w} / ${h}` }),
  ...extra,
});

/** one image at its frame box — always drawn at the frame's exact proportions */
function Pic({
  src,
  alt,
  x,
  y,
  w,
  h,
  priority,
  parallax,
  className = "",
  sizes,
  mo,
}: {
  src: string;
  alt: string;
  x: number;
  y: number;
  w: number;
  h: number;
  priority?: boolean;
  parallax?: boolean;
  className?: string;
  sizes?: string;
  mo?: number;
}) {
  const s = sizes ?? `(max-width: 1023px) 100vw, ${Math.ceil((w / 1440) * 100)}vw`;
  return (
    <figure className={`sj-a sj-pic ${className}`} style={at(x, y, w, h, mo != null ? { "--mo": mo } : {})} data-reveal>
      {parallax ? (
        <div className="sj-par" data-parallax>
          <Image src={A + src} alt={alt} fill sizes={s} priority={priority} />
        </div>
      ) : (
        <Image src={A + src} alt={alt} fill sizes={s} priority={priority} />
      )}
    </figure>
  );
}

function T({
  x,
  y,
  w,
  size,
  className = "",
  children,
  as: Tag = "p",
  align,
  mo,
}: {
  x: number;
  y: number;
  w: number;
  size: number;
  className?: string;
  children: ReactNode;
  as?: "p" | "h2" | "h3" | "div";
  align?: "center" | "right";
  mo?: number;
}) {
  return (
    <Tag
      className={`sj-a sj-t ${className}`}
      style={at(x, y, w, undefined, {
        "--fs": size,
        ...(align && { textAlign: align }),
        ...(mo != null && { "--mo": mo }),
      })}
      data-reveal
    >
      {children}
    </Tag>
  );
}

/** a section of the frame: [y0, y1) in frame px */
function S({ y0, y1, className = "", children, label }: { y0: number; y1: number; className?: string; children: ReactNode; label?: string }) {
  return (
    <section className={`sj-s ${className}`} style={{ "--y0": y0, "--sh": y1 - y0 } as V} aria-label={label}>
      {children}
    </section>
  );
}

const hl = (c: string, t: string) => <span style={{ color: c }}>{t}</span>;

/* ------------------------------------------------------------- beat charts */

type Beat = string[];
const L1: Beat[] = [
  ["1. Start", "Forest Start Point", "Calm, unfamiliar", "Basic movement & camera", "Establish protagonist and forest"],
  ["2. First Exploration", "Start → Water", "Curiosity", "Follow path, environmental interaction", "Introduce the forest ecosystem"],
  ["3. Water Discovery", "Water area", "Wonder", "Small traversal / crossing", "Establish water as a natural landmark"],
  ["4. First Junction", "Node", "Choice", "Choose between forest paths", "Introduce exploration and player agency"],
  ["5. Forest Part 1", "Upper forest", "Discovery", "Navigation, climbing, jumping", "Introduce first environmental clues"],
  ["6. Forest Part 2", "Deeper forest", "Mild tension", "Jumping obstacles, fallen trees, pits", "Gradually increase traversal difficulty"],
  ["7. Animal Encounter 1", "Forest", "Surprise", "Observe / avoid / react", "Show that wildlife is part of the world"],
  ["8. Animal Encounter 2", "Forest", "Tension", "Chase / escape sequence", "Increase stakes and introduce danger"],
  ["9. Forest Part 3", "Dense forest", "Unease", "More complex navigation", "Forest begins feeling mysterious"],
  ["10. Forest Part 4", "Sloped forest", "Excitement", "Slide down slope / fast traversal", "First major movement set-piece"],
  ["11. Final Shrine", "Shrine area", "Wonder / mystery", "Explore and interact", "First strong connection to Gond spirituality"],
  ["12. Cave Entrance", "Transition", "Anticipation", "Follow clue/path toward cave", "End of Level 1 forest section"],
];
const L1_HEAD = ["Beat", "Location", "Player Experience", "Gameplay", "Narrative / Purpose"];
const L1_COLS = [185, 185, 185, 328, 357];

const L2: Beat[] = [
  ["01", "Cave Entrance", "Curious → Uneasy", "Enter cave", "Cave as ancestral memory", "Enter Cave"],
  ["02", "Painting 01 + Bana 1", "Wonder → Discovery", "Examine painting + Bana 1", "Introduce Bana origin", "Bana 1"],
  ["03", "Painting 02 + Bana 2", "Understanding → Connection", "Examine painting + Bana 2", "Tattoos tied to identity", "Bana 2"],
  ["04", "Central Cave", "Explore → Orient", "Explore central area", "Paintings are part of a story", "Unlock cave paths"],
  ["05", "Painting 03 + Bana 3", "Mystery → Empathy", "Examine painting + Bana 3", "Kali Kankali + collective strength", "Bana 3"],
  ["06", "Exploration", "Curious → Immersed", "Explore cave details", "Daily practices & nature ties", "Context"],
  ["07", "Painting 04 + Bana 4", "Revelation → Clarity", "Examine final painting + Bana 4", "Forest warning & sacred tree", "Bana Complete"],
  ["08", "Reflection", "Relief → Reflection", "Rest & observe", "Process revelations", "Consolidate"],
  ["09", "Final Discovery", "Understanding → Purpose", "Assemble Bana", "Bana tied to ritual", "Bana + Ritual"],
  ["10", "Cave Exit", "Determined → Anticipating", "Leave with Bana", "Understands tattoos, Bana & forest", "Sacred Saja"],
];
const L2_HEAD = ["Beat", "Location", "Player Experience", "Gameplay / Interaction", "Narrative Reveal", "Progression"];
// as in the frame, with 18 units moved from "Narrative Reveal" to "Progression" so "Unlock cave paths" fits on one line
const L2_COLS = [52, 185, 253, 286, 304, 152];
/** pieces of the Bana collected by the end of each Level 2 beat (0–4) */
const BANA = [0, 1, 2, 2, 3, 3, 4, 4, 4, 4];

/** map hotspots: where a beat happens on the level map (% of the map), and which rows it belongs to */
type Spot = { x: number; y: number; label: string; rows: number[] };
const L1_SPOTS: Spot[] = [
  { x: 4.2, y: 51, label: "Start point", rows: [0] },
  { x: 16.5, y: 47, label: "Water", rows: [1, 2] },
  { x: 19.8, y: 34.5, label: "Node — first junction", rows: [3] },
  { x: 19.3, y: 11.5, label: "Part 1 — upper forest", rows: [4] },
  { x: 51.4, y: 15.5, label: "Animal escape", rows: [6, 7] },
  { x: 50.6, y: 57, label: "Animal escape", rows: [6, 7] },
  { x: 58.1, y: 79.5, label: "Animal escape", rows: [6, 7] },
  { x: 71.8, y: 82, label: "Jumping obstacles — pit and tree log", rows: [5] },
  { x: 15.1, y: 78.5, label: "Part 3 — dense forest", rows: [8] },
  { x: 83.8, y: 82, label: "Slide down the slope", rows: [9] },
  { x: 28.5, y: 52, label: "Final shrine", rows: [10] },
  { x: 97.5, y: 42, label: "Toward the cave", rows: [11] },
];
const L2_SPOTS: Spot[] = [
  { x: 4.3, y: 69.7, label: "Cave entry", rows: [0] },
  { x: 20.2, y: 53, label: "Cave painting", rows: [1, 2, 4, 6] },
  { x: 33.5, y: 84, label: "Cave painting", rows: [1, 2, 4, 6] },
  { x: 59.2, y: 21, label: "Cave painting", rows: [1, 2, 4, 6] },
  { x: 60.9, y: 85, label: "Cave painting", rows: [1, 2, 4, 6] },
  { x: 92.6, y: 31, label: "Cave painting", rows: [1, 2, 4, 6] },
  { x: 54, y: 72, label: "Central cave", rows: [3, 5] },
  { x: 96.5, y: 81, label: "Healing corner — rest & reflect", rows: [7, 8] },
];

function BeatTable({
  head,
  rows,
  cols,
  x,
  y,
  w,
  h,
  active,
  onActive,
  bana,
  label,
}: {
  head: string[];
  rows: Beat[];
  cols: number[];
  x: number;
  y: number;
  w: number;
  h: number;
  active: number[];
  onActive: (r: number | null) => void;
  bana?: number[];
  label: string;
}) {
  const total = cols.reduce((a, b) => a + b, 0);
  return (
    <div className="sj-a sj-table" style={at(x, y, w, h)} data-reveal>
      <table aria-label={label}>
        <colgroup>
          {cols.map((c, i) => (
            <col key={i} style={{ width: `${(c / total) * 100}%` }} />
          ))}
        </colgroup>
        <thead>
          <tr>
            {head.map((c) => (
              <th key={c} scope="col">
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody onMouseLeave={() => onActive(null)}>
          {rows.map((r, i) => (
            <tr key={i} style={{ "--r": i } as V} data-on={active.includes(i) || undefined} onMouseEnter={() => onActive(i)} onFocus={() => onActive(i)} tabIndex={0}>
              {r.map((c, j) => (
                <td key={j}>
                  {c}
                  {bana && j === r.length - 1 && bana[i] > 0 && (
                    <span className="sj-bana" role="img" aria-label={`Bana ${bana[i]} of 4`} style={{ "--b": bana[i] } as V}>
                      {[0, 1, 2, 3].map((k) => (
                        <i key={k} data-on={k < bana[i] || undefined} />
                      ))}
                    </span>
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function MapSpots({ spots, active, onSpot }: { spots: Spot[]; active: number[]; onSpot: (rows: number[] | null) => void }) {
  return (
    <div className="sj-spots">
      {spots.map((s, i) => (
        <button
          key={i}
          type="button"
          className="sj-spot"
          style={{ left: `${s.x}%`, top: `${s.y}%` } as V}
          data-on={s.rows.some((r) => active.includes(r)) || undefined}
          onMouseEnter={() => onSpot(s.rows)}
          onMouseLeave={() => onSpot(null)}
          onFocus={() => onSpot(s.rows)}
          onBlur={() => onSpot(null)}
          aria-label={`${s.label}: beat ${s.rows.map((r) => r + 1).join(", ")}`}
        >
          <span>{s.label}</span>
        </button>
      ))}
    </div>
  );
}

/* --------------------------------------------------------------- the page */

const isEmbed = (u: string) => /youtube\.com|youtu\.be|vimeo\.com/.test(u);
const embedUrl = (u: string) => {
  const yt = u.match(/(?:youtu\.be\/|v=|embed\/)([\w-]{11})/);
  if (yt) return `https://www.youtube-nocookie.com/embed/${yt[1]}?rel=0`;
  const vm = u.match(/vimeo\.com\/(?:video\/)?(\d+)/);
  return vm ? `https://player.vimeo.com/video/${vm[1]}` : u;
};

/** the design-process block (cream band → art direction → footprints) moved down by this much in the new frame */
const P = 6622;

/** a line that draws itself as you scroll (pathLength 1 → CSS draws it with --d) */
function Draw({
  x,
  y,
  w,
  h,
  vb,
  paths,
  width,
  className = "",
}: {
  x: number;
  y: number;
  w: number;
  h: number;
  vb: string;
  paths: string[];
  width: number;
  className?: string;
}) {
  return (
    <svg className={`sj-a sj-draw sj-deco ${className}`} style={at(x, y, w, h, { "--sw": width })} viewBox={vb} aria-hidden="true" data-draw>
      {paths.map((d, i) => (
        <path key={i} d={d} pathLength={1} />
      ))}
    </svg>
  );
}

/** a short vertical stem with a dot (or point) at its end that draws down as you arrive */
function Stem({ x, y, h, tip = "dot" }: { x: number; y: number; h: number; tip?: "dot" | "point" }) {
  const end = tip === "dot" ? h - 8 : h - 15;
  return (
    <svg className="sj-a sj-stem sj-deco" style={at(x, y, 16, h, { "--len": end })} viewBox={`0 0 16 ${h}`} aria-hidden="true" data-sp>
      <path d={`M8 0V${end}`} />
      {tip === "dot" ? <circle cx="8" cy={h - 8} r="8" /> : <path className="sj-stem-tip" d={`M6.5 ${end}L0 ${h}H16L9.5 ${end}Z`} />}
    </svg>
  );
}

const FOREST_OUTLINES: [number, number, number, number, string][] = [
  [
    347.7,
    3928.7,
    149,
    89,
    "M135.92 32.20L139.65 46.94C140.05 48.52 140.62 50.05 141.35 51.51C148.88 66.59 137.92 84.32 121.07 84.32H15.00C7.08 84.32 1.49 75.66 6.25 69.32C8.65 66.12 27.92 58.32 37.25 54.82L52.96 47.70C59.53 44.73 63.75 38.19 63.75 30.98C63.75 24.66 67.00 18.78 72.36 15.42L80.88 10.08C88.82 5.10 98.40 3.36 107.58 5.22C121.41 8.03 132.45 18.52 135.92 32.20Z",
  ],
  [
    272.9,
    3861.9,
    168,
    154,
    "M164.08 72.58L142.40 36.06C137.94 28.56 131.48 22.44 123.74 18.39L103.63 7.88C86.43 -1.10 65.38 8.63 61.09 27.56C58.90 37.25 51.98 45.19 42.69 48.70L35.65 51.36C32.61 52.50 29.71 53.98 27.00 55.77L26.07 56.39C11.25 66.18 3.82 83.96 7.25 101.39C7.80 104.18 8.08 107.01 8.08 109.85V124.20C8.08 126.41 7.46 128.57 6.30 130.45C1.40 138.36 7.09 148.58 16.40 148.58H80.58",
  ],
  [
    366.3,
    3774.5,
    144,
    163,
    "M43.16 118.5V102.86C43.16 95.41 41.20 88.10 37.49 81.64L36.79 80.44C34.72 76.84 32.02 73.64 28.82 70.99L22.00 65.35C20.16 63.83 17.85 63 15.47 63H13.90C6.46 63 1.98 54.76 6.02 48.52C7.09 46.88 8.64 45.61 10.46 44.89L19.00 41.53C22.31 40.22 26.01 40.27 29.29 41.65C35.29 44.16 42.26 42.08 45.87 36.67C46.39 35.89 46.83 35.06 47.18 34.18L49.38 28.69C50.22 26.59 51.56 24.73 53.29 23.27C55.79 21.16 58.95 20 62.23 20H75.66H82.04C88.25 20 92.76 14.89 97.16 10.5C98.50 9.15 100.75 7.74 102.88 6.58C105.64 5.09 108.78 4.5 111.92 4.5H115.82C121.89 4.5 127.47 7.80 130.39 13.12L131.62 15.37C133.23 18.30 133.44 21.79 132.20 24.90C131.52 26.60 130.42 28.11 129.02 29.30L126.02 31.82C123.41 34.02 122.47 37.63 123.69 40.82L123.80 41.11C124.92 44.05 127.74 46 130.88 46C132.97 46 135.01 46.83 136.26 48.50C138.55 51.54 140.59 55.47 138.16 57C126.35 64.38 113.93 71 100.00 71H97.16H85.17C81.85 71 79.16 73.69 79.16 77.01C79.16 79.67 80.91 82.01 83.46 82.77L90.04 84.72C91.77 85.23 93.40 86.05 94.84 87.13L97.08 88.82C99.40 90.55 102.23 91.5 105.12 91.5H107.52C111.26 91.5 114.67 93.66 116.25 97.06C116.85 98.33 117.16 99.72 117.16 101.13V108.65C117.16 110.22 118.43 111.5 120.01 111.5C121.03 111.5 121.97 112.04 122.48 112.93L125.66 118.5C126.99 121.16 128.06 126.6 121.66 127C117.58 127.25 111.92 127.25 107.24 127.17C103.02 127.10 99.04 125.27 96.14 122.20C93.88 119.79 90.92 118.14 87.68 117.47L76.49 115.17C75.94 115.05 75.37 115 74.81 115H73.70C70.22 115 67.27 117.53 66.74 120.96C66.69 121.32 66.66 121.68 66.66 122.03V122.60C66.66 125.47 67.51 128.27 69.09 130.65L75.66 140.5L79.16 146L82.78 153.90C84.02 156.60 84.66 159.53 84.66 162.5",
  ],
  [
    936.6,
    3947.7,
    112,
    87,
    "M4.42 84.25L7.25 68.56C8.92 59.33 15.15 51.56 23.81 47.94C28.78 45.86 33.03 42.37 36.05 37.91L52.39 13.74C54.38 10.79 57.08 8.41 60.25 6.79C71.31 1.15 84.83 6.30 89.34 17.88L91.42 23.25L96.79 41.48C98.20 46.30 98.92 51.30 98.92 56.33V62.91C98.92 68.04 100.31 73.08 102.92 77.50L105.65 82.10C106.48 83.51 106.92 85.12 106.92 86.75",
  ],
  [
    1010.9,
    3873.9,
    134,
    164,
    "M129.63 162.60L109.13 83.16C106.84 74.30 107.09 64.98 109.85 56.26L114.60 41.24C118.45 29.07 113.65 15.82 102.89 8.94C95.20 4.02 85.60 3.13 77.13 6.54L68.91 9.85C59.65 13.58 51.87 20.26 46.79 28.85L43.77 33.94C41.35 38.04 38.47 41.84 35.19 45.29L20.13 61.10L3.13 77.60",
  ],
  [
    946,
    3771.1,
    129,
    188,
    "M45.48 187.38C45.48 185.96 45.48 173.99 45.48 161.19C45.48 150.86 33.92 144.74 25.37 150.54C21.44 153.21 16.35 153.50 12.14 151.28L11.76 151.08C5.22 147.64 2.63 139.59 5.93 132.98L9.03 126.78C10.95 122.95 14.02 119.80 17.81 117.78L19.56 116.85C28.71 111.98 32.93 101.16 29.48 91.38C25.10 81.07 24.84 66.87 35.17 62.51C35.27 62.47 35.38 62.42 35.48 62.38C36.96 61.81 38.63 60.86 40.34 59.70C48.06 54.50 51.48 45.15 51.48 35.84V33.02C51.48 29.64 52.24 26.30 53.70 23.25C55.83 18.79 59.35 15.16 63.74 12.89L71.12 9.08C72.02 8.62 72.80 7.97 73.40 7.17C76.84 2.64 83.99 4.13 85.34 9.65L86.50 14.42C86.82 15.71 86.84 17.05 86.61 18.36C85.53 24.63 84.47 34.73 86.98 36.88C90.48 39.88 94.48 50.38 98.48 50.38C102.48 50.38 111.98 53.88 114.48 55.88C120.08 60.37 123.98 66.72 123.98 73.90C123.98 77.31 123.98 80.28 123.98 81.38C123.98 84.38 107.98 84.38 105.48 91.38C104.62 93.79 103.48 96.66 102.34 99.42C100.18 104.64 101.88 110.70 106.55 113.88C108.46 115.19 109.94 117.03 110.80 119.18L114.48 128.38",
  ],
  [
    1030.9,
    3746.6,
    94,
    131,
    "M4.06 70.55L4.71 69.17C10.96 56.09 25.81 51.30 36.06 41.05C37.79 39.31 42.18 29.39 44.93 22.77C45.68 20.97 46.06 19.04 46.06 17.09V15.94C46.06 8.88 53.82 0.56 57.56 6.55C59.56 9.75 62.06 20.55 63.06 25.55C63.39 30.71 64.26 41.65 65.06 44.05C65.56 45.57 67.57 48.64 69.52 51.41C71.47 54.18 74.07 56.42 77.00 58.12L77.84 58.61C80.62 60.21 83.00 62.42 84.81 65.06C87.25 68.64 88.56 72.86 88.56 77.19C88.56 78.51 88.56 79.59 88.56 80.05C88.56 81.16 77.03 83.23 70.05 84.32C69.06 84.47 68.09 84.75 67.16 85.14C63.65 86.65 60.86 89.77 60.89 93.60C60.91 94.99 61.09 96.26 61.56 97.05C63.06 99.55 72.56 103.05 72.56 106.05C72.56 112.83 78.72 118.96 74.91 124.58L72.56 128.05",
  ],
];

const CAVE_OUTLINES = [
  "M171.06 101.25L184.28 116.27C185.95 118.17 188.10 119.60 190.51 120.40L239.54 136.74M171.06 101.25L142.74 96.23M171.06 101.25L202.25 55.35M142.74 96.23L126.01 110.22C125.45 110.69 124.85 111.12 124.23 111.49L82.50 136.74M142.74 96.23V85.75C142.74 80.88 145.21 76.34 149.30 73.70L171.06 59.65M82.50 136.74L92.06 167.08C92.61 168.83 93.50 170.46 94.66 171.88L111.18 191.96L142.74 225.30M82.50 136.74L96.84 96.23M82.50 136.74L37.68 169.73L1.83 200.56M142.74 225.30H169.21C170.44 225.30 171.66 225.15 172.85 224.83L216.97 213.24C219.08 212.69 221.04 211.65 222.70 210.22L238.36 196.70C241.81 193.72 243.64 189.28 243.28 184.73L239.54 136.74M158.51 27.03L111.18 39.58L76.76 59.65L58.12 77.94L34.03 96.78C31.52 98.74 29.73 101.5 28.96 104.59L26.99 112.44C26.71 113.58 26.57 114.75 26.57 115.92V139.55C26.57 141.48 26.18 143.4 25.42 145.17L1.83 200.56L45.87 224.49C46.86 225.03 47.91 225.45 49.00 225.74L92.98 237.54C95.51 238.21 98.17 238.19 100.68 237.46L142.74 225.30M239.54 136.74L255.61 98.91C256.37 97.14 256.75 95.23 256.75 93.31V67.90M256.75 67.90L227.71 55.35M158.51 27.03L166.72 10.38C169.34 5.07 174.95 1.91 180.85 2.44L280.42 11.25V34.37C280.42 37.73 279.24 40.99 277.08 43.57L256.75 67.90M227.71 55.35H202.25M227.71 55.35L280.42 11.25M202.25 55.35L171.06 59.65M202.25 55.35L194.01 22.37M171.06 59.65V57.12C171.06 49.95 165.76 43.87 158.65 42.91L134.13 39.58M158.51 27.03L134.13 39.58L125.17 67.90L96.84 96.23M96.84 96.23L76.76 59.65M125.17 67.90L111.18 39.58M158.51 27.03L194.01 22.37L280.42 11.25",
  "M749.54 128.94L744.44 86.56C743.28 76.96 733.37 71.04 724.37 74.56L678.96 92.36M749.54 128.94L778.74 134.12M749.54 128.94L698.91 192.51M778.74 134.12L795.98 119.69C796.56 119.21 797.17 118.77 797.81 118.38L840.83 92.36M778.74 134.12V144.91C778.74 149.93 776.19 154.61 771.97 157.33L749.54 171.81M840.83 92.36L832.59 66.23C831.05 61.34 827.08 57.59 822.11 56.34L795.56 49.64C790.61 48.40 786.66 44.69 785.10 39.83L774.30 6.25M846.74 171.81L865.96 115.64L840.83 92.36M840.83 92.36L885.97 59.13C886.67 58.61 887.32 58.04 887.92 57.41L908.83 35.44M774.30 6.25L752.95 1.79C750.71 1.32 748.39 1.38 746.17 1.96L702.23 13.51C700.05 14.08 698.03 15.14 696.32 16.62L680.18 30.56C676.62 33.63 674.74 38.21 675.10 42.89L678.96 92.36M811.26 192.51L846.74 171.81L865.96 152.96L890.78 133.55C893.37 131.52 895.22 128.69 896.01 125.49L898.04 117.40C898.33 116.23 898.48 115.03 898.48 113.82V87.93C898.48 86.94 898.58 85.96 898.77 84.99L908.83 35.44L883.06 7.58C879.35 3.57 873.75 1.93 868.47 3.31L829.03 13.60C827.06 14.11 825.01 14.21 823.00 13.90L774.30 6.25M678.96 92.36L662.39 131.35C661.62 133.18 661.22 135.14 661.22 137.13V163.31M725.89 210.25L698.91 192.51L706.67 152.96L661.22 163.31M811.26 192.51V206.55L788.90 230.73C785.76 234.12 781.21 235.85 776.61 235.40L636.83 221.70V197.87C636.83 194.41 638.04 191.05 640.26 188.39L661.22 163.31M706.67 152.96L636.83 221.70M698.91 192.51L749.54 171.81M749.54 171.81V174.43C749.54 181.82 755.01 188.08 762.33 189.07L787.61 192.51M787.61 192.51L796.85 163.31L865.96 115.64M796.85 163.31L811.26 192.51M787.61 192.51L811.26 206.55M636.83 221.70L725.89 210.25M725.89 210.25L768.58 208.40L811.26 206.55",
];

/** the two dot clusters beside "The Experience is just not the location" */
const DOTS: [number, number, number, string][] = [
  [127, 6287, 14, "#d9d9d9"],
  [99, 6313, 14, "#d9d9d9"],
  [141, 6306, 7, "#d9d9d9"],
  [113, 6332, 7, "#d9d9d9"],
  [145, 6320, 7, "#d9d9d9"],
  [125, 6339, 7, "#d9d9d9"],
  [152, 6335, 7, "#d9d9d9"],
  [135, 6346, 7, "#d9d9d9"],
  [166, 6339, 7, "#d9d9d9"],
  [139, 6362, 7, "#d9d9d9"],
  [1141, 6341, 13, "#6e5143"],
  [1167, 6343, 13, "#6e5143"],
  [1191, 6350, 13, "#6e5143"],
  [1215, 6360, 13, "#6e5143"],
  [1143, 6377, 13, "#6e5143"],
  [1167, 6377, 13, "#6e5143"],
  [1191, 6383, 13, "#6e5143"],
  [1211, 6392, 13, "#6e5143"],
];

export function SongsOfSaaja({ project }: { project: Project }) {
  const root = useRef<HTMLDivElement>(null);
  // linked hover between the level maps and their beat charts
  const [beat1, setBeat1] = useState<number | null>(null);
  const [spot1, setSpot1] = useState<number[] | null>(null);
  const [beat2, setBeat2] = useState<number | null>(null);
  const [spot2, setSpot2] = useState<number[] | null>(null);

  // scroll-linked drawing: progress trail, journey lines, outlines, nodes, connectors, footprints, the moving strip
  useEffect(() => {
    const el = root.current;
    const scroller = el?.closest<HTMLElement>(".cs");
    if (!el || !scroller) return;
    const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const trail = Array.from(el.querySelectorAll<SVGPathElement>(".sj-trail-mask path"));
    const lens = trail.map((p) => p.getTotalLength());
    const total = lens.reduce((a, b) => a + b, 0);
    trail.forEach((p, i) => {
      p.style.strokeDasharray = `${lens[i]} ${lens[i]}`;
    });
    const trailBox = el.querySelector<SVGSVGElement>(".sj-trail");
    const nodes = Array.from(el.querySelectorAll<HTMLElement>("[data-node]"));
    const linked = Array.from(el.querySelectorAll<HTMLElement>("[data-sp]"));
    const drawn = Array.from(el.querySelectorAll<SVGElement>("[data-draw]"));
    const pans = Array.from(el.querySelectorAll<HTMLElement>("[data-pan]"));
    const clamp = (n: number) => Math.min(1, Math.max(0, n));
    let raf = 0;
    const update = () => {
      raf = 0;
      const vh = innerHeight;
      if (trailBox) {
        const r = trailBox.getBoundingClientRect();
        // the tip of the trail follows a point a little below the middle of the screen
        const p = reduced ? 1 : clamp((vh * 0.62 - r.top) / r.height);
        let left = p * total;
        trail.forEach((path, i) => {
          const d = Math.min(lens[i], Math.max(0, left));
          left -= lens[i];
          path.style.strokeDashoffset = String(lens[i] - d);
        });
      }
      for (const n of nodes) n.toggleAttribute("data-lit", reduced || n.getBoundingClientRect().top < vh * 0.62);
      for (const n of linked) {
        const r = n.getBoundingClientRect();
        if (r.bottom < -vh || r.top > vh * 2) continue;
        n.style.setProperty("--sp", (reduced ? 1 : clamp((vh * 0.92 - r.top) / (vh * 0.62))).toFixed(3));
      }
      // lines drawn by scroll: the tip stays a little below the middle of the screen
      for (const n of drawn) {
        const r = n.getBoundingClientRect();
        if (r.bottom < -vh || r.top > vh * 2) continue;
        n.style.setProperty("--d", (reduced ? 1 : clamp((vh * 0.7 - r.top) / Math.max(r.height, vh * 0.25))).toFixed(4));
      }
      // the Gond art strip travels sideways while it crosses the screen
      for (const n of pans) {
        const r = n.getBoundingClientRect();
        if (r.bottom < -vh || r.top > vh * 2) continue;
        n.style.setProperty("--pan", (reduced ? 0.5 : clamp((vh - r.top) / (vh + r.height))).toFixed(4));
      }
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };
    update();
    const late = setTimeout(update, 500);
    scroller.addEventListener("scroll", onScroll, { passive: true });
    addEventListener("resize", onScroll);
    return () => {
      clearTimeout(late);
      cancelAnimationFrame(raf);
      scroller.removeEventListener("scroll", onScroll);
      removeEventListener("resize", onScroll);
    };
  }, []);

  const roles = project.role.split(" / ");
  const disciplines = project.tags.filter((t) => !project.tools.includes(t));
  const video = project.video;
  const rows1 = spot1 ?? (beat1 != null ? [beat1] : []);
  const rows2 = spot2 ?? (beat2 != null ? [beat2] : []);

  return (
    <div className="sj" ref={root}>
      <h1 className="sr-only">{project.title}</h1>

      {/* ------------------------------------------------ key art + the question */}
      <S y0={0} y1={1823} className="sj-intro" label="Introduction">
        <div className="sj-a sj-hero" style={at(0, 0, 1440, 810)}>
          <div className="sj-par" data-parallax>
            <div className="sj-breathe">
              <Image
                src={A + "keyart.webp"}
                alt="Songs of Saaja — A Journey Through Roots: key art of a Gond woman looking over a sacred valley at sunset"
                fill
                priority
                sizes="100vw"
              />
            </div>
          </div>
          <div className="sj-motes" aria-hidden="true">
            {Array.from({ length: 14 }, (_, i) => (
              <i key={i} style={{ "--i": i } as V} />
            ))}
          </div>
        </div>
        <div className="sj-a sj-band sj-deco" style={at(0, 810, 1440, 188)} aria-hidden="true" data-drift />
        <Stem x={712} y={810} h={298} />
        <svg className="sj-a sj-ring sj-deco" style={at(703, 1083, 34, 34)} viewBox="0 0 34 34" aria-hidden="true">
          <circle cx="17" cy="17" r="15.5" />
        </svg>
        <h2 className="sj-a sj-t sj-q" style={at(100, 1153, 1240, undefined, { "--fs": 48 })} data-reveal>
          WHAT DOES IT MEAN TO {hl("#935b44", "BELONG")}?
        </h2>
        {[1312, 1432, 1552, 1672].map((y) => (
          <i key={y} className="sj-a sj-qline sj-deco" style={at(335, y, 770)} aria-hidden="true" data-reveal />
        ))}
        <T x={100} y={1343} w={1240} size={48} align="center" className="sj-q">
          Is it the {hl("#ffd342", "Story")}?
        </T>
        <T x={100} y={1463} w={1240} size={48} align="center" className="sj-q">
          The {hl("#ffd342", "Society")}?
        </T>
        <T x={100} y={1583} w={1240} size={48} align="center" className="sj-q">
          Or the {hl("#ffd342", "Identity")}?
        </T>
        <Stem x={712.3} y={1673} h={150} tip="point" />
      </S>

      {/* ----------------------------------------- the Gond art strip, moving sideways */}
      <S y0={1823} y1={2177} className="sj-strip-s" label="Gond art">
        <div className="sj-a sj-strip" style={at(0, 1823, 1440, 354)} data-pan>
          {/* eslint-disable-next-line @next/next/no-img-element -- a 4171-unit-wide strip that pans; next/image can't size it */}
          <img src={A + "strip.webp"} alt="A Gond-art procession: villagers, animals, trees and huts on the way to the forest" width={1920} height={163} />
        </div>
      </S>

      {/* ----------------------------------------------------- statement + meta */}
      <S y0={2177} y1={2860} className="sj-statement" label="About the game">
        <p className="sj-a sj-t sj-lede" style={at(166, 2274, 1109, undefined, { "--fs": 48 })} data-reveal>
          <Highlighted text={project.description} />
        </p>
        <dl className="sj-meta">
          {[
            ["Role", roles, 100],
            ["Year", [project.year], 414],
            ["Discipline", disciplines, 730],
            ["Tools", project.tools, 1044],
          ].map(([k, v, x]) => (
            <div key={k as string} className="sj-a sj-meta-col" style={at(x as number, 2599, 296)} data-reveal>
              <dt>{k as string}</dt>
              {(v as string[]).map((t) => (
                <dd key={t} data-bullet={k !== "Year" || undefined}>
                  {t}
                </dd>
              ))}
            </div>
          ))}
        </dl>
      </S>

      {/* ------------------------------------------------------ gameplay video */}
      <S y0={2860} y1={3671} className="sj-video-s" label="Gameplay video">
        <i className="sj-a sj-hr sj-deco" style={at(1, 2907, 567)} aria-hidden="true" />
        <i className="sj-a sj-hr sj-deco" style={at(865, 2907, 575)} aria-hidden="true" />
        <T x={605} y={2885} w={233} size={32} as="h2" className="sj-gold sj-nw">
          Gameplay Video
        </T>
        {/* the frame's video slot, 1240 × 697.5 (16:9). Add the video in the dashboard (Project → Video: a YouTube / Vimeo link or a file) and it plays here */}
        <div className="sj-a sj-video" style={at(100, 2973, 1240, 697.5)} data-reveal data-empty={!video || undefined}>
          {video ? (
            isEmbed(video) ? (
              <iframe
                src={embedUrl(video)}
                title={`${project.title} gameplay video`}
                allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
                allowFullScreen
                loading="lazy"
              />
            ) : (
              <video src={video} controls playsInline preload="metadata" aria-label={`${project.title} gameplay video`} />
            )
          ) : (
            <p className="sj-video-soon">Gameplay video coming soon</p>
          )}
        </div>
      </S>

      {/* ------------------------------------------------- the journey · chapter 1 */}
      <S y0={3671} y1={4960} className="sj-forest" label="Chapter 1 — the forest">
        <Draw
          x={76.3}
          y={3658.6}
          w={1280}
          h={1213}
          vb="0 0 1280 1213"
          width={4}
          className="sj-journey-line"
          paths={[
            "M47.70 0.42L4.90 197.41C-1.07 224.88 2.23 253.56 14.29 278.96C34.80 322.12 77.77 350.14 125.53 351.49L1077.92 378.48C1136.43 380.14 1188.46 416.12 1210.66 470.27L1266.64 606.80C1282.58 645.68 1281.24 689.51 1262.96 727.35L1210.27 836.37C1187.83 882.79 1142.84 914.20 1091.53 919.25L239.71 1003.18C191.77 1007.9 149.13 1035.66 125.41 1077.59L49.68 1211.42",
          ]}
        />
        <T x={138} y={3675} w={259} size={48} as="h2" align="center" className="sj-nw sj-journey-title" mo={0}>
          The Journey
        </T>
        {FOREST_OUTLINES.map(([x, y, w, h, d], i) => (
          <Draw key={i} x={x} y={y} w={w} h={h} vb={`0 0 ${w} ${h}`} width={9} className="sj-outline" paths={[d]} />
        ))}
        <T x={443} y={3858} w={554} size={64} as="h3" align="center" className="sj-chapter sj-nw" mo={1}>
          THE FOREST
        </T>
        <T x={520} y={3923} w={400} size={48} align="center" className="sj-chapter-n sj-nw" mo={2}>
          Chapter 1
        </T>
        <T x={243} y={4083} w={955} size={32} align="center" className="sj-white" mo={3}>
          The forest is not simply where the game takes place.
          <br />
          the player has to learn to read.
        </T>
        <figure className="sj-a sj-pic sj-env" style={at(202.4, 4202.8, 1035.1, 610.4, { "--mo": 5 })} data-reveal>
          <Image
            src={A + "environment.webp"}
            alt="The environment: the forest level in Unreal Engine — rocky hills, trees and a river valley"
            fill
            sizes="(max-width: 1023px) 100vw, 72vw"
          />
        </figure>
        <img className="sj-a sj-deco sj-env-frame" src={A + "env-frame.svg"} alt="" style={at(0, 4123, 1440, 749)} />
        <T x={432} y={4478} w={576} size={48} as="h3" align="center" className="sj-ink sj-nw sj-env-title" mo={4}>
          The Environment
        </T>
        <Stem x={712} y={4859} h={86} />
      </S>

      {/* --------------------------------------------- guiding without telling */}
      <S y0={4960} y1={5640} className="sj-guide" label="Level 1 — guiding without telling">
        <h2 className="sj-a sj-t sj-guide-q" style={at(100, 4997, 1240, undefined, { "--fs": 40, textAlign: "center" })} data-reveal>
          HOW DO YOU DESIGN A FOREST THAT
          <br />
          {hl("#c78f74", "GUIDES WITHOUT TELLING?")}
        </h2>
        <figure className="sj-a sj-map" style={at(100, 5149, 1240, 280.3)} data-reveal>
          <div className="sj-map-in">
            <Image
              src={A + "level1-map.webp"}
              alt="Level 1 layout: start point, water, node, parts 1–4, final shrine, animal escapes, jumping obstacles and the slide down the slope"
              fill
              sizes="(max-width: 1023px) 1000px, 86vw"
            />
            <MapSpots spots={L1_SPOTS} active={rows1} onSpot={setSpot1} />
          </div>
        </figure>
        <i className="sj-a sj-rule2 sj-deco" style={at(100, 5479, 1240)} aria-hidden="true" data-reveal />
        <T x={100} y={5501} w={1240} size={36} align="center" className="sj-cues">
          by using environmental {hl("#c78f74", "landmarks, changes in vegetation, water")} and {hl("#c78f74", "spatial composition")} as navigational cues.
        </T>
        <i className="sj-a sj-rule2 sj-deco" style={at(100, 5611, 1240)} aria-hidden="true" data-reveal />
      </S>

      {/* ------------------------------------------------ drafts: 1 → 8 */}
      <S y0={5640} y1={6440} className="sj-drafts" label="Terrain drafts">
        <Pic
          src="terrain.webp"
          alt="Draft 1, a greybox terrain sculpt, beside Draft 8, the textured forest paths seen from above"
          x={100}
          y={5663.3}
          w={1240}
          h={437}
          className="sj-zoom"
        />
        <Draw
          x={73.3}
          y={6092.5}
          w={1243}
          h={476}
          vb="0 0 1243 476"
          width={4}
          className="sj-journey-line"
          paths={[
            "M26.23 2.46L7.37 70.48C-5.55 117.14 5.15 167.18 36.05 204.46L95.10 275.70C124.49 311.16 168.72 330.92 214.74 329.15L661.23 311.96L1066.83 274.71C1119.11 269.91 1170.03 293.17 1200.63 335.84L1222.89 366.88C1245.44 398.33 1246.57 440.34 1225.73 472.96",
          ]}
        />
        <div className="sj-a sj-range" style={at(115, 6135, 1210, 75)} data-sp>
          <p className="sj-range-a">
            <strong>Draft 1</strong>
            <span>Greyboxing and Environment sculpting</span>
          </p>
          <p className="sj-range-mid">Playtests, Matching References, Asset replacements</p>
          <p className="sj-range-b">
            <strong>Draft 8</strong>
            <span>Refining paths with textures and assets</span>
          </p>
          <svg className="sj-range-line" viewBox="157 0 899 14" preserveAspectRatio="none" aria-hidden="true">
            <path d="M157 7H1044" />
            <path d="M1044 1 1056 7 1044 13Z" />
          </svg>
          <i className="sj-range-dot" aria-hidden="true" />
        </div>
        <svg className="sj-a sj-dots sj-deco" style={at(90, 6280, 1150, 130)} viewBox="90 6280 1150 130" aria-hidden="true" data-sp>
          {DOTS.map(([x, y, s, c], i) => (
            <circle key={i} cx={x + s / 2} cy={y + s / 2} r={s / 2} fill={c} style={{ "--k": i % 10 } as V} />
          ))}
        </svg>
        <T x={403} y={6292} w={634} size={36} className="sj-nw sj-intent">
          The Experience is just not {hl("#ffd342", "the location")}
        </T>
        <T x={578} y={6330} w={284} size={32} className="sj-nw sj-intent2">
          But also the intent
        </T>
      </S>

      <S y0={6440} y1={6960} className="sj-beat1" label="Beat chart for level 1">
        <h2 className="sr-only">Beat chart for level 1</h2>
        <BeatTable head={L1_HEAD} rows={L1} cols={L1_COLS} x={100} y={6470} w={1240} h={468} active={rows1} onActive={setBeat1} label="Beat chart for level 1" />
      </S>

      {/* ------------------------------------------------- chapter 2 · the cave */}
      <S y0={6960} y1={7420} className="sj-cave" label="Chapter 2 — the cave">
        <Draw
          x={119.9}
          y={6917.3}
          w={1209}
          h={580}
          vb="0 0 1209 580"
          width={4}
          className="sj-journey-line"
          paths={[
            "M1206.11 2.74L1179.78 46.57C1148.83 98.08 1089.8 125.77 1030.41 116.63L864.77 91.15C854.35 89.55 843.80 89.06 833.28 89.70L573.81 105.47C565.35 105.98 556.87 105.77 548.45 104.83L326.74 80.15C312.39 78.55 297.89 79.06 283.69 81.66L194.96 97.93C165.42 103.34 138.23 117.61 116.99 138.85L70.93 184.91C58.15 197.69 47.82 212.70 40.45 229.19L19.76 275.51C13.03 290.56 8.87 306.62 7.44 323.04L2.55 379.16C-0.92 419.15 11.98 458.85 38.33 489.14L114.10 576.24",
          ]}
        />
        <Draw x={271.2} y={7036.4} w={911} h={240} vb="0 0 911 240" width={2.9} className="sj-outline" paths={CAVE_OUTLINES} />
        <T x={473} y={7122} w={494} size={64} as="h2" align="center" className="sj-chapter sj-nw">
          THE CAVE
        </T>
        <T x={520} y={7187} w={400} size={48} align="center" className="sj-chapter-n sj-nw">
          Chapter 2
        </T>
        <T x={223} y={7316} w={994} size={32} align="center" className="sj-white">
          The Forest is where she explores. The Cave is where the player understands their purpose.
        </T>
      </S>

      <S y0={7420} y1={1856 + P} className="sj-l2" label="Level 2 — the cave">
        <figure className="sj-a sj-map" style={at(100, 7437, 1240, 491.7)} data-reveal>
          <div className="sj-map-in">
            <Image
              src={A + "level2-map.webp"}
              alt="The Cave: first draft map — cave entry, six cave paintings and a healing corner"
              fill
              sizes="(max-width: 1023px) 1000px, 86vw"
            />
            <MapSpots spots={L2_SPOTS} active={rows2} onSpot={setSpot2} />
          </div>
        </figure>
        <BeatTable
          head={L2_HEAD}
          rows={L2}
          cols={L2_COLS}
          x={100}
          y={7924}
          w={1240}
          h={402}
          active={rows2}
          onActive={setBeat2}
          bana={BANA}
          label="Beat chart for level 2"
        />
        <i className="sj-a sj-hr sj-deco sj-hr-draw" style={at(101, 8365, 835)} aria-hidden="true" data-reveal />
        <T x={851} y={8345} w={489} size={32} as="h2" align="right" className="sj-nw">
          The Beat Chart for Level 2
        </T>
      </S>

      {/* ------------------------------------------------- design process (cream) */}
      <S y0={1856 + P} y1={2986 + P} className="sj-process" label="Design process">
        <div className="sj-a sj-cream sj-deco" style={at(1, 1856 + P, 1440, 1130)} aria-hidden="true" />
        <img className="sj-a sj-deco sj-rock" src={A + "rock-tr.svg"} alt="" style={at(967, 1749 + P, 474, 490)} data-drift />
        <img className="sj-a sj-deco sj-rock" src={A + "rock-bl.svg"} alt="" style={at(1, 2789 + P, 215, 283)} />
        <img className="sj-a sj-deco sj-sun" src={A + "sun-lg.svg"} alt="" style={at(1204, 1774 + P, 266, 266)} />
        <img className="sj-a sj-deco sj-sun sj-sun-r" src={A + "sun-sm.svg"} alt="" style={at(1315, 1945 + P, 123, 123)} />
        <img className="sj-a sj-deco sj-sun" src={A + "sun-lg.svg"} alt="" style={at(-112, 2895 + P, 266, 266)} />
        <img className="sj-a sj-deco sj-sun sj-sun-r" src={A + "sun-sm.svg"} alt="" style={at(44, 3038 + P, 123, 123)} />
        <img className="sj-a sj-deco sj-glyphs" src={A + "glyphs.webp"} alt="" style={at(1215, 2880 + P, 180, 212)} />
        {/* the half-and-half disc where the trail begins */}
        <svg className="sj-a sj-deco sj-disc" style={at(622, 1796 + P, 119, 119)} viewBox="0 0 119 119" aria-hidden="true">
          <circle cx="59.5" cy="59.5" r="59.5" fill="#FAF8E9" />
          <path d="M119 59.5a59.5 59.5 0 0 1-119 0Z" fill="#161412" />
          <path d="M79 60a19 19 0 0 0-38 0Z" fill="#161412" />
          <path d="M79 60a19 19 0 0 1-38 0Z" fill="#FAF8E9" />
        </svg>
        {/* progress trail: one dashed line through the whole design process */}
        <svg className="sj-a sj-trail sj-deco" style={at(152.4, 1906.7 + P, 1246, 2029)} viewBox="0 0 1246 2029" aria-hidden="true">
          <defs>
            <mask id="sj-trail-a" maskUnits="userSpaceOnUse" className="sj-trail-mask">
              <path d="M527.55 0.27C518.55 49.27 534.28 156.58 663.65 86.27C829.25 -3.73 985.05 54.27 1044.55 105.77C1092.15 146.97 1109.68 209.77 1114.15 237.27C1125.81 309.1 1132.43 473.78 1008.65 546.77C883.15 620.77 871.65 632.27 652.65 588.27C587.94 575.27 405.75 483.97 352.15 500.77C285.15 521.77 148.55 541.77 58.55 676.77C-13.45 784.77 -0.69 926.6 9.15 981.77C12.48 1012.33 26.52 1046.31 49.65 1079.85" />
            </mask>
            <mask id="sj-trail-b" maskUnits="userSpaceOnUse" className="sj-trail-mask">
              <path d="M49.6 1079.77C133.91 1202.11 346.72 1240.46 594.15 1162.27C903.65 1020.27 1199.15 1299.77 1230.65 1456.27C1255.46 1579.52 1302.15 1993.77 760.15 2026.77" />
            </mask>
          </defs>
          <path
            mask="url(#sj-trail-a)"
            stroke="#161412"
            d="M527.55 0.27C518.55 49.27 534.28 156.58 663.65 86.27C829.25 -3.73 985.05 54.27 1044.55 105.77C1092.15 146.97 1109.68 209.77 1114.15 237.27C1125.81 309.1 1132.43 473.78 1008.65 546.77C883.15 620.77 871.65 632.27 652.65 588.27C587.94 575.27 405.75 483.97 352.15 500.77C285.15 521.77 148.55 541.77 58.55 676.77C-13.45 784.77 -0.69 926.6 9.15 981.77C12.48 1012.33 26.52 1046.31 49.65 1079.85"
          />
          <path
            mask="url(#sj-trail-b)"
            stroke="#FAF8E9"
            d="M49.6 1079.77C133.91 1202.11 346.72 1240.46 594.15 1162.27C903.65 1020.27 1199.15 1299.77 1230.65 1456.27C1255.46 1579.52 1302.15 1993.77 760.15 2026.77"
          />
        </svg>
        <span className="sj-a sj-node sj-deco" data-node style={at(706, 1994 + P, 35, 35)} aria-hidden="true" />
        <span className="sj-a sj-node sj-deco" data-node style={at(704, 2450 + P, 35, 35)} aria-hidden="true" />

        <h2 className="sj-a sj-t" style={at(101, 1919 + P, 1340, undefined, { "--fs": 48, color: "#161412" })} data-reveal>
          How did i reach here?
        </h2>
        <T x={101} y={1979 + P} w={158} size={24} className="sj-ink sj-nw">
          Design Process
        </T>
        <T x={572} y={2037 + P} w={299} size={32} as="h3" className="sj-ink0 sj-nw">
          Research &amp; Folklore
        </T>
        <T x={280} y={2103 + P} w={883} size={24} className="sj-ink2">
          Studied Gond cultural context, the Pari Kupar Lingo and Kali Kankali tradition, Kachargarh, oral traditions, music, shrines and the relationship between
          community and forest.
        </T>
        <Pic src="research.webp" alt="Field research: caves, shrines and rituals at Kachargarh, and Gond art" x={160} y={2253 + P} w={1123} h={172} className="sj-zoom" />
        <T x={641} y={2522 + P} w={213} size={32} as="h3" className="sj-ink0 sj-nw">
          Game Concept
        </T>
        <T x={280} y={2572 + P} w={883} size={24} className="sj-ink2">
          Developed the story of a young Gond woman who is treated as an outsider and enters the forest after being blamed for the decline of a sacred tree.
        </T>
        <div className="sj-a sj-chip" style={at(465, 2655 + P, 513, 53, { "--fs": 32 })} data-reveal>
          Story → Character → Theme
        </div>
        <i className="sj-a sj-rule sj-deco" style={at(561, 2733 + P, 321)} aria-hidden="true" />
        <T x={280} y={2761 + P} w={900} size={24} className="sj-ink2">
          Connected exploration with meaningful tasks, discovery and tattoo progression:
        </T>
        <div className="sj-a sj-chip sj-chip-sm" style={at(216, 2814 + P, 1011, 53, { "--fs": 24 })} data-reveal>
          Explore → Interact → Complete a task → Receive a tattoo → Learn → Explore deeper.
        </div>
      </S>

      {/* ----------------------------------------------------------- iteration */}
      <S y0={2986 + P} y1={3900 + P} className="sj-iter" label="Iteration and refinement">
        <span className="sj-a sj-node sj-node-lt sj-deco" data-node style={at(704, 3058 + P, 35, 35)} aria-hidden="true" />
        <T x={552} y={3141 + P} w={339} size={32} as="h2" className="sj-nw">
          Iteration &amp; Refinement
        </T>
        <T x={280} y={3204 + P} w={883} size={24} className="sj-ink3">
          Iterated the terrain and level layout through multiple drafts, moving from early terrain studies toward the later forest versions and developed 3D environment.
        </T>
        <Pic
          src="iteration.webp"
          alt="Whiteboard drafts of the level layout (LD-3) and the story map: main character, tattoo, level 1 notes"
          x={359}
          y={3326 + P}
          w={745}
          h={549}
          parallax
        />
      </S>

      {/* ---------------------------------------------- final player journey */}
      <S y0={3900 + P} y1={4180 + P} className="sj-journey" label="Final player journey">
        <img className="sj-a sj-deco sj-journey-art" src={A + "journey.svg"} alt="" style={at(1, 3395 + P, 1440, 983)} />
        <span className="sj-a sj-node sj-node-end sj-deco" data-node style={at(884, 3910 + P, 48, 48)} aria-hidden="true" />
        <T x={573} y={3914 + P} w={296} size={32} as="h2" className="sj-nw">
          Final Player Journey
        </T>
        <div className="sj-journey-band">
          <T x={277} y={4016 + P} w={871} size={24} className="sj-ink sj-nw">
            The completed experience follows the protagonist from outsider to protector:
          </T>
          <div className="sj-a sj-chip sj-chip-dark" style={at(125, 4062 + P, 1178, 53, { "--fs": 24 })} data-reveal>
            Forest exploration → Cave discovery → Cultural knowledge → Crafting → Offering → Final tattoo.
          </div>
        </div>
      </S>

      {/* ------------------------------------------------------ art direction */}
      <S y0={4180 + P} y1={5720 + P} className="sj-art" label="Art direction">
        <T x={620} y={4197 + P} w={203} size={32} as="h2" className="sj-nw">
          Art Direction
        </T>
        <div className="sj-a sj-star sj-deco" style={at(479, 4242 + P, 483, 27)} aria-hidden="true" data-reveal>
          <i />
          <svg viewBox="0 0 27 27">
            <path d="M13.5 0 16 11 27 13.5 16 16 13.5 27 11 16 0 13.5 11 11Z" />
          </svg>
          <i />
        </div>
        <T x={213} y={4274 + P} w={1016} size={24} align="center" className="sj-ink3">
          The environment combines realistic natural forms with {hl("#fffb8b", "a heightened, atmospheric presentation")}. Inspired from the Gond folklore and
          photorealistic references from games like Uncharted 4 for the jungle and{" "}
          {hl("#ffc873", "actual jungle images from Andhara pradesh, Chattisgarh and Madhya Pradesh")}.
        </T>

        {/* dashed connectors from the map to each reference sheet (drawn in the old frame's coordinates, placed at the new spot) */}
        <svg className="sj-a sj-links sj-deco" style={at(1, 4580 + P, 1440, 600)} viewBox="0 4580 1440 600" aria-hidden="true" data-sp>
          <path d="M330 4649.5C405 4649.5 405 4700 405 4719S405 4792 479.5 4792" />
          <circle cx="479.5" cy="4792" r="5.3" />
          <path d="M697 5007C772 5007 772 5052 772 5080S772 5150 846.6 5150" />
          <circle cx="697" cy="5007" r="5.3" />
          <path d="M480 4792C455 4890 475 4990 475 5075C475 5100 455 5114 425 5114" />
          <circle cx="480" cy="4792" r="5.3" />
          <path d="M1070.6 4605C1035 4609 1021.5 4655 1021.5 4711C1021.5 4755 995 4792 961 4792" />
          <circle cx="961" cy="4792" r="5.3" />
          <path d="M960 4792C985 4905 1055 4935 1175 4936C1235 4937 1251 4947 1251 4972.5" />
          <circle cx="960" cy="4792" r="5.3" />
        </svg>

        <Pic
          src="refs-jungle.webp"
          alt="Jungle references from Uncharted 4: overgrown ruins, misty forest, waterfalls"
          x={1}
          y={4433 + P}
          w={332}
          h={416}
          className="sj-ref"
          mo={10}
        />
        <Pic
          src="map-india.webp"
          alt="Map of India marking the Gond regions: Maharashtra, Madhya Pradesh, Chhattisgarh and Odisha"
          x={472}
          y={4585 + P}
          w={498}
          h={434}
          className="sj-ref sj-ref-map"
          mo={1}
        />
        <Pic
          src="refs-characters.webp"
          alt="Character reference: Gond people, jewellery, clothing and tattoos"
          x={1071}
          y={4416 + P}
          w={370}
          h={383}
          className="sj-ref"
          mo={2}
        />
        <T x={1071} y={4805 + P} w={300} size={20} className="sj-label" mo={3}>
          Character Reference
        </T>
        <T x={285} y={4926 + P} w={200} size={20} className="sj-label" mo={4}>
          Cave references
        </T>
        <Pic
          src="refs-caves.webp"
          alt="Cave references: waterfalls, rock shelters, Bhimbetka and Cueva de las Manos cave paintings"
          x={1}
          y={4953 + P}
          w={425}
          h={441}
          className="sj-ref"
          mo={5}
        />
        <T x={503} y={5068 + P} w={300} size={20} className="sj-label" mo={6}>
          Animal &amp; Trap References
        </T>
        <Pic
          src="refs-animals.webp"
          alt="Animal and trap references: sambar deer, leopard cat, wolf, forest floor"
          x={505}
          y={5099 + P}
          w={431}
          h={373}
          className="sj-ref"
          mo={7}
        />
        <Pic
          src="refs-environment.webp"
          alt="Environment special asset: concept art of the giant sacred tree"
          x={1012}
          y={4977 + P}
          w={429}
          h={322}
          className="sj-ref"
          mo={8}
        />
        <T x={1012} y={5312 + P} w={300} size={20} className="sj-label" mo={9}>
          Environment Special Asset
        </T>

        {/* footprints walking down the trails toward the assets */}
        <div className="sj-a sj-walk sj-deco" style={at(1, 5300 + P, 1440, 420)} aria-hidden="true" data-sp>
          <svg viewBox="0 5300 1440 420">
            <path d="M192.5 5402C183.3 5454.8 211.9 5560.5 399.5 5560.5C587.1 5560.5 681.7 5539 701.5 5612.5" />
            <path d="M1269 5302C1278.2 5354.8 1269 5560.5 991 5560.5C803.4 5560.5 733.8 5562 714 5635.5" />
            <path d="M733 5473.5C742.2 5526.3 772.5 5555.4 722.5 5582.5C666.5 5612.8 738.3 5622.5 718.5 5696" />
            <circle cx="720" cy="5707" r="11" />
          </svg>
          {(
            [
              [204, 5435, 47, 55, 0],
              [179, 5493, 39, 52, 1],
              [293, 5515, 48, 31, 2],
              [330, 5562, 51, 37, 3],
              [460, 5518, 47, 30, 4],
              [493, 5566, 52, 40, 5],
              [655, 5526, 49, 47, 6],
              [651, 5582, 45, 49, 7],
              [1170, 5435, 54, 51, 0.5],
              [1175, 5497, 51, 54, 1.5],
              [1074, 5511, 48, 30, 2.5],
              [1034, 5558, 51, 38, 3.5],
              [924, 5523, 48, 30, 4.5],
              [884, 5570, 51, 38, 5.5],
            ] as const
          ).map(([x, y, w, h, k]) => (
            <i key={`${x}-${y}`} className="sj-foot" style={{ "--fx": x, "--fy": y, "--fw": w, "--fh": h, "--k": k } as V} />
          ))}
        </div>
      </S>

      {/* ------------------------------------------------------------ the assets */}
      <S y0={12342} y1={13060} className="sj-asset2" label="The Bana">
        <Pic
          src="asset-bana.webp"
          alt="Asset building: the Bana, a traditional string instrument, modelled and textured in Blender"
          x={100}
          y={12366}
          w={1240}
          h={686}
          className="sj-zoom"
        />
        <div className="sj-a sj-bana-card" style={at(493, 12895, 415, 121)} data-reveal>
          <h3>Bana</h3>
          <p>Cultural Instrument used for Celebrations and prayers</p>
        </div>
      </S>

      <S y0={13060} y1={13820} className="sj-asset1" label="Sculptures and statues">
        <Pic
          src="asset-shrine.webp"
          alt="Asset building: the shrine statue sculpted in ZBrush, textured in Substance Painter and assembled in Blender"
          x={100.5}
          y={13085}
          w={1239}
          h={703}
          className="sj-zoom"
        />
        <div className="sj-a sj-bana-card sj-card-wide" style={at(493, 13614, 521, 121)} data-reveal>
          <h3>Sculptures &amp; Statues</h3>
          <p>Cultural Instrument used for Celebrations and prayers</p>
        </div>
      </S>

      <S y0={13820} y1={14275} className="sj-close" label="Status">
        <div className="sj-a sj-asset" style={at(100, 13829, 1240, 75, { "--dl": 268, "--dw": 973 })} data-reveal>
          <h3>Asset Building</h3>
          <p>Blender, Zbrush and Substance Painter</p>
          <i aria-hidden="true" />
        </div>
        <i className="sj-a sj-hr sj-hr-in sj-deco" style={at(99, 13940, 1242)} aria-hidden="true" />
        <T x={304} y={14016} w={833} size={32} align="center">
          Most of the processes are similar to the previous level and the {hl("#f2bc4c", "level 2")} is still under Progress.
        </T>
        <i className="sj-a sj-hr sj-hr-in sj-deco" style={at(100, 14170, 1240)} aria-hidden="true" />
      </S>
    </div>
  );
}
