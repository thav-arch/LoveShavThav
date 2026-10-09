import { computeLayout, type Layout } from "./layout";
import { onProjectsChange, projects } from "./projects";

/**
 * Mutable per-frame state shared by the WebGL scene, the DOM labels and the
 * GSAP transitions. It is deliberately NOT React state: it is written and
 * read every frame, and GSAP tweens its fields directly.
 *
 * Counts are live bindings: they follow the published projects from the CMS.
 */
export let PROJECT_COUNT = 1;
/** the track repeats the projects so the arc is always full and loops seamlessly */
export let COPIES = 2;
export let INSTANCE_COUNT = 2;

function recount() {
  PROJECT_COUNT = Math.max(1, projects.length);
  COPIES = Math.max(2, Math.ceil(10 / PROJECT_COUNT));
  INSTANCE_COUNT = projects.length ? PROJECT_COUNT * COPIES : 0;
}
recount();
onProjectsChange(recount);

export const motion = {
  layout: computeLayout(1440, 900) as Layout,
  viewport: { w: 1440, h: 900 },

  /** carousel position in "card" units: 0 = instance 0 centred. Unbounded (loops). */
  pos: 0,
  target: 0,
  /** current position along the film strip in world units (derived from pos) */
  arc: 0,
  /** smoothed velocity in cards / second (drives the cloth-like bend) */
  vel: 0,
  /** springy follower of vel: drives frame bending, overshoots a little on stop */
  flex: 0,
  flexV: 0,
  /** slower follower for the outer frames, so the bend ripples outward along the strip */
  flexSlow: 0,
  flexSlowV: 0,
  /** film tension: gaps open slightly while the strip moves (1 = at rest) */
  spread: 1,
  /** temporary damping override (intro uses a slow settle) */
  dampOverride: 0,

  pointer: { x: 0, y: 0, px: 0, py: 0, inside: false },
  interaction: "idle" as "idle" | "wheel" | "drag",
  dragging: false,
  lastInput: 0,

  hovered: -1,

  /** 0→1 page-load reveal */
  intro: 0,
  /** 1 = carousel visible, 0 = dropped away (FULL index) */
  worldVis: 1,
  /** 0→1 selected card flying to fill the screen */
  fly: 0,
  flyInstance: -1,
  /** liquid portal (profile / playground) */
  portal: { open: 0 },

  /** stop rendering while the case study covers the canvas */
  paused: false,
  reducedMotion: false,

  /** WebGL-side theme values, set from the CMS theme settings */
  theme: { gridHue: 0, gridIntensity: 1, cursorWake: true, wakeStrength: 0.018, cardRadius: 0.045 },
};

export type Motion = typeof motion;

// handy for tuning in the browser console during development
if (process.env.NODE_ENV !== "production" && typeof window !== "undefined") {
  (window as unknown as { __motion: Motion }).__motion = motion;
}

export const mod = (n: number, m: number) => ((n % m) + m) % m;
/** wrap to [-m/2, m/2) */
export const wrapSigned = (n: number, m: number) => mod(n + m / 2, m) - m / 2;
export const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
/** frame-rate independent exponential smoothing */
export const damp = (a: number, b: number, lambda: number, dt: number) => a + (b - a) * (1 - Math.exp(-lambda * dt));

export const projectAtInstance = (k: number) => mod(k, PROJECT_COUNT);
export const activeProjectIndex = () => mod(Math.round(motion.pos), PROJECT_COUNT);
/** the instance currently nearest the centre */
export const centreInstance = () => mod(Math.round(motion.pos), INSTANCE_COUNT);

/** shortest carousel position that centres project `index` from the current position */
export function positionFor(index: number, from = motion.target) {
  const base = Math.round(from);
  return base + wrapSigned(index - mod(base, PROJECT_COUNT), PROJECT_COUNT);
}
