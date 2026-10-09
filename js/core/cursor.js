// Ported from lib/cursor.ts (types stripped; logic unchanged)
let domLabel = null;
let sceneLabel = null;
let current = null;
const listeners = new Set();
function emit() {
    const next = domLabel ?? sceneLabel;
    if (next === current)
        return;
    current = next;
    listeners.forEach((fn) => fn(current));
}
export const setDomCursor = (label) => {
    domLabel = label;
    emit();
};
export const setSceneCursor = (label) => {
    if (label === sceneLabel)
        return;
    sceneLabel = label;
    emit();
};
export const onCursorLabel = (fn) => {
    listeners.add(fn);
    return () => void listeners.delete(fn);
};
