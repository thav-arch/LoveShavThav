/**
 * Cursor label channel. DOM elements declare their label with a
 * `data-cursor="LABEL"` attribute; the WebGL scene sets its label imperatively
 * (VIEW / PREV / NEXT / DRAG). A DOM label always wins over the scene label.
 */
type Listener = (label: string | null) => void;

let domLabel: string | null = null;
let sceneLabel: string | null = null;
let current: string | null = null;
const listeners = new Set<Listener>();

function emit() {
  const next = domLabel ?? sceneLabel;
  if (next === current) return;
  current = next;
  listeners.forEach((fn) => fn(current));
}

export const setDomCursor = (label: string | null) => {
  domLabel = label;
  emit();
};
export const setSceneCursor = (label: string | null) => {
  if (label === sceneLabel) return;
  sceneLabel = label;
  emit();
};
export const onCursorLabel = (fn: Listener) => {
  listeners.add(fn);
  return () => void listeners.delete(fn);
};
