import * as THREE from "three";
import type { Project } from "@/lib/projects";

/**
 * Card titles drawn INTO the 3D card, so the text bends, rolls and scrolls
 * with the film exactly (an HTML overlay can only follow a flat plane).
 *
 * The label covers the bottom band of the card (LABEL_BAND of its height).
 * It is a mask texture, not colours: R = title, G = meta line (category ·
 * year), B = the "open" indicator. The card shader (shaders/card.ts) prints
 * white text from these masks, fading the meta and indicator separately
 * (meta by focus, indicator by focus/hover) — one texture, one draw.
 */
export const LABEL_BAND = 0.42;

const W = 1600; // canvas width; height follows the band's shape
const cache = new Map<string, THREE.CanvasTexture>();
let fontsReady = false;
const redraws = new Set<() => void>();
if (typeof document !== "undefined" && document.fonts) {
  document.fonts.ready.then(() => {
    fontsReady = true;
    redraws.forEach((fn) => fn());
    redraws.clear();
  });
}

/** the site's own font stack, resolved (CSS variables don't work in canvas) */
function fontFamily() {
  if (typeof document === "undefined") return "sans-serif";
  return getComputedStyle(document.body).fontFamily || "sans-serif";
}

function wrap(g: CanvasRenderingContext2D, text: string, max: number) {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let line = "";
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (g.measureText(test).width > max && line) {
      lines.push(line);
      line = w;
    } else line = test;
  }
  if (line) lines.push(line);
  return lines;
}

function draw(canvas: HTMLCanvasElement, p: Project, frameAspect: number) {
  const H = Math.round((W * LABEL_BAND) / frameAspect);
  canvas.width = W;
  canvas.height = H;
  const g = canvas.getContext("2d")!;
  g.fillStyle = "#000";
  g.fillRect(0, 0, W, H);
  g.globalCompositeOperation = "lighter"; // masks add up per channel
  g.textBaseline = "alphabetic";
  const family = fontFamily();
  // sizes in card-height units → canvas px (the card is W / frameAspect tall)
  const unit = W / frameAspect;
  const inset = unit * 0.07;
  const maxW = W - inset * 2 - unit * 0.28; // leave room for the indicator

  // title: up to two lines, shrinking if a long title needs it
  let size = unit * 0.115;
  let lines: string[] = [];
  for (let k = 0; k < 6; k++) {
    g.font = `500 ${size}px ${family}`;
    lines = wrap(g, p.title, maxW);
    if (lines.length <= 2) break;
    size *= 0.88;
  }
  lines = lines.slice(0, 2);
  g.fillStyle = "rgb(255,0,0)";
  const lh = size * 0.98;
  const base = H - inset;
  lines.forEach((l, i) => g.fillText(l, inset - size * 0.04, base - (lines.length - 1 - i) * lh));

  // meta: CATEGORY · YEAR, small caps above the title
  const meta = [p.subtitle, p.year].filter(Boolean).join("   ·   ").toUpperCase();
  if (meta) {
    const ms = unit * 0.034;
    g.font = `500 ${ms}px ${family}`;
    if ("letterSpacing" in g) (g as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = `${ms * 0.1}px`;
    g.fillStyle = "rgb(0,255,0)";
    g.fillText(meta, inset, base - lines.length * lh - ms * 0.6, maxW);
    if ("letterSpacing" in g) (g as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = "0px";
  }

  // indicator: a ring with an arrow, bottom right
  const r = unit * 0.06;
  const cx = W - inset - r;
  const cy = H - inset - r * 0.9;
  g.strokeStyle = "rgb(0,0,255)";
  g.fillStyle = "rgb(0,0,255)";
  g.lineWidth = unit * 0.006;
  g.beginPath();
  g.arc(cx, cy, r, 0, Math.PI * 2);
  g.stroke();
  const a = r * 0.42;
  g.beginPath();
  g.moveTo(cx - a, cy);
  g.lineTo(cx + a, cy);
  g.moveTo(cx + a * 0.35, cy - a * 0.6);
  g.lineTo(cx + a, cy);
  g.lineTo(cx + a * 0.35, cy + a * 0.6);
  g.stroke();
}

/** shared label texture for a project at a given frame shape */
export function getLabelTexture(p: Project, frameAspect: number) {
  const key = `${p.slug}|${p.title}|${p.subtitle}|${p.year}|${frameAspect.toFixed(3)}`;
  let tex = cache.get(key);
  if (!tex) {
    const canvas = document.createElement("canvas");
    draw(canvas, p, frameAspect);
    tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.NoColorSpace; // masks, not colours
    tex.minFilter = THREE.LinearMipmapLinearFilter;
    tex.generateMipmaps = true;
    tex.anisotropy = 8;
    cache.set(key, tex);
    if (!fontsReady) {
      const t = tex;
      redraws.add(() => {
        draw(canvas, p, frameAspect);
        t.needsUpdate = true;
      });
    }
  }
  return tex;
}

export function disposeLabelTextures() {
  cache.forEach((t) => t.dispose());
  cache.clear();
}
