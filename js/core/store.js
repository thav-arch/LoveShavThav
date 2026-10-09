/**
 * Low-frequency UI state (replaces the original zustand store).
 *   mode:       WORLD (Featured) · INDEX (Full) · PROFILE (portal) · PROJECT (a case study is open)
 *   transition: idle · entering · exiting
 * Anything that changes every frame lives in the `motion` object (core/motion.js) instead.
 */
const listeners = new Set();

export const state = {
  mode: "WORLD",
  /** project index (0..N-1) currently in the centre of the strip */
  activeIndex: 0,
  selectedSlug: null,
  transition: "idle",
  direction: 1,
  /** where the open project was launched from — used for the matching exit */
  openedFrom: "world",
  introDone: false,
};

export function set(patch) {
  const prev = { ...state };
  Object.assign(state, patch);
  listeners.forEach((fn) => fn(state, prev));
}

export const subscribe = (fn) => {
  listeners.add(fn);
  return () => void listeners.delete(fn);
};

export const isPortalMode = (m) => m === "PROFILE";
