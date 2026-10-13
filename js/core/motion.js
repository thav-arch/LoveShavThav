// Ported from lib/motion.ts (types stripped; logic unchanged)
import { computeLayout } from "./layout.js";
import { onProjectsChange, projects } from "./projects.js";
/**
 * Mutable per-frame state shared by the WebGL scene, the DOM labels and the
 * GSAP transitions. It is deliberately NOT React state: it is written and
 * read every frame, and GSAP tweens its fields directly.
 *
 * Counts are live bindings: they follow the published projects from the CMS.
 */
export let PROJECT_COUNT = 1;
/** one frame per project: the strip has a first and a last project and does not loop */
export let INSTANCE_COUNT = 1;
function recount() {
    PROJECT_COUNT = Math.max(1, projects.length);
    INSTANCE_COUNT = projects.length ? PROJECT_COUNT : 0;
}
recount();
onProjectsChange(recount);
export const motion = {
    layout: computeLayout(1440, 900),
    viewport: { w: 1440, h: 900 },
    /** carousel position in "card" units: 0 = first project centred, PROJECT_COUNT - 1 = last */
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
    interaction: "idle",
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
// handy for tuning in the browser console during development
if (typeof window !== "undefined") {
    window.__motion = motion;
}
export const mod = (n, m) => ((n % m) + m) % m;
/** wrap to [-m/2, m/2) */
export const wrapSigned = (n, m) => mod(n + m / 2, m) - m / 2;
export const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
/** frame-rate independent exponential smoothing */
export const damp = (a, b, lambda, dt) => a + (b - a) * (1 - Math.exp(-lambda * dt));
export const projectAtInstance = (k) => mod(k, PROJECT_COUNT);
/** the strip stops at the first and last project: clamp a position into that range */
export const clampPos = (p) => clamp(p, 0, PROJECT_COUNT - 1);
export const activeProjectIndex = () => clampPos(Math.round(motion.pos));
/** the frame currently nearest the centre */
export const centreInstance = () => clampPos(Math.round(motion.pos));
/** carousel position that centres project `index` */
export function positionFor(index) {
    return clampPos(index);
}
