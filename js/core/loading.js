// Ported from lib/loading.ts (types stripped; logic unchanged)
const state = { scene: 0, texturesLoaded: 0, texturesTotal: 0, ready: false };
const listeners = new Set();
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
    expectTextures(n) {
        state.texturesTotal = Math.max(state.texturesTotal, n);
        emit();
    },
    textureLoaded() {
        state.texturesLoaded++;
        emit();
    },
    markReady() {
        if (state.ready)
            return;
        state.ready = true;
        state.scene = 1;
        state.texturesLoaded = Math.max(state.texturesLoaded, state.texturesTotal);
        emit();
    },
    subscribe(fn) {
        listeners.add(fn);
        return () => void listeners.delete(fn);
    },
};
/** the loader calls this when its shutters open; the carousel plays the intro */
let revealHandler = null;
let revealRequested = false;
export function onReveal(fn) {
    revealHandler = fn;
    if (revealRequested)
        fn();
}
export function requestReveal() {
    revealRequested = true;
    revealHandler?.();
}
