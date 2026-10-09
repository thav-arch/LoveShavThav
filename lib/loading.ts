/**
 * First-load progress for the film-reel loader (components/FilmLoader.tsx).
 * Real signals: the 3D scene chunk has mounted, and each project's preview
 * texture has decoded. `ready` flips when the world can be revealed.
 */
type Listener = () => void;

const state = { scene: 0, texturesLoaded: 0, texturesTotal: 0, ready: false };
const listeners = new Set<Listener>();
const emit = () => listeners.forEach((fn) => fn());

export const loading = {
  get ready() {
    return state.ready;
  },
  /** 0..1 */
  progress() {
    const tex = state.texturesTotal ? state.texturesLoaded / state.texturesTotal : 0;
    return Math.min(1, 0.15 + 0.35 * state.scene + 0.5 * tex);
  },
  sceneMounted() {
    state.scene = 1;
    emit();
  },
  expectTextures(n: number) {
    state.texturesTotal = Math.max(state.texturesTotal, n);
    emit();
  },
  textureLoaded() {
    state.texturesLoaded++;
    emit();
  },
  markReady() {
    if (state.ready) return;
    state.ready = true;
    state.scene = 1;
    state.texturesLoaded = Math.max(state.texturesLoaded, state.texturesTotal);
    emit();
  },
  subscribe(fn: Listener) {
    listeners.add(fn);
    return () => void listeners.delete(fn);
  },
};

/** the loader calls this when its shutters open; the carousel plays the intro */
let revealHandler: (() => void) | null = null;
let revealRequested = false;
export function onReveal(fn: () => void) {
  revealHandler = fn;
  if (revealRequested) fn();
}
export function requestReveal() {
  revealRequested = true;
  revealHandler?.();
}
