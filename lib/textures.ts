import * as THREE from "three";
import type { Project } from "@/lib/projects";
import { loading } from "./loading";

/**
 * Progressive card textures: a tiny preview (thumbnail-sm) is decoded first so
 * the world can appear quickly; the full-resolution thumbnail is swapped in
 * when the browser is idle. Images are decoded off the main thread through
 * createImageBitmap where available. If a file is missing, a generated
 * fallback texture keeps the card usable.
 *
 * One entry per project — duplicated carousel instances share textures.
 */
type Entry = {
  texture: THREE.Texture;
  aspect: number;
  listeners: Set<() => void>;
  disposed: boolean;
};

const cache = new Map<string, Entry>();
let maxAnisotropy = 4;
export const setMaxAnisotropy = (n: number) => (maxAnisotropy = Math.min(8, n));

function prepare(t: THREE.Texture) {
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = maxAnisotropy;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.generateMipmaps = true;
  t.needsUpdate = true;
  return t;
}

function fallback(p: Project) {
  const c = document.createElement("canvas");
  c.width = 512;
  c.height = 320;
  const g = c.getContext("2d")!;
  g.fillStyle = "#111";
  g.fillRect(0, 0, c.width, c.height);
  g.fillStyle = p.accent;
  for (let i = 0; i < 26; i++) g.fillRect((i * 37) % 512, 0, 2, 320);
  g.fillStyle = "#fff";
  g.font = "600 34px system-ui, sans-serif";
  g.fillText(p.title, 24, 290);
  return prepare(new THREE.CanvasTexture(c));
}

async function loadImage(url: string): Promise<{ texture: THREE.Texture; aspect: number }> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url}: ${res.status}`);
  const blob = await res.blob();
  if (typeof createImageBitmap === "function") {
    const bmp = await createImageBitmap(blob, { imageOrientation: "flipY" });
    const t = new THREE.Texture(bmp as unknown as HTMLImageElement);
    t.flipY = false;
    return { texture: prepare(t), aspect: bmp.width / bmp.height };
  }
  const img = new Image();
  img.src = URL.createObjectURL(blob);
  await img.decode();
  return { texture: prepare(new THREE.Texture(img)), aspect: img.naturalWidth / img.naturalHeight };
}

function swap(e: Entry, next: { texture: THREE.Texture; aspect: number }) {
  if (e.disposed) return next.texture.dispose();
  const old = e.texture;
  e.texture = next.texture;
  e.aspect = next.aspect;
  e.listeners.forEach((fn) => fn());
  disposeTexture(old);
}

function disposeTexture(t: THREE.Texture) {
  const img = t.image as ImageBitmap | undefined;
  t.dispose();
  if (img && typeof (img as ImageBitmap).close === "function") (img as ImageBitmap).close();
}

const idle = (fn: () => void) =>
  "requestIdleCallback" in window ? window.requestIdleCallback(fn, { timeout: 2500 }) : setTimeout(fn, 600);

/** returns immediately with a placeholder; resolves `ready` once the preview is decoded */
export function getProjectTexture(p: Project) {
  const key = `${p.slug}|${p.thumbnail}`;
  let e = cache.get(key);
  if (!e) {
    const empty = new THREE.DataTexture(new Uint8Array([12, 12, 12, 255]), 1, 1);
    empty.needsUpdate = true;
    e = { texture: empty, aspect: 1.6, listeners: new Set(), disposed: false };
    cache.set(key, e);
    const entry = e;
    const ready = loadImage(p.thumbnailSmall)
      .catch(() => loadImage(p.thumbnail))
      .then((r) => swap(entry, r))
      .catch(() => swap(entry, { texture: fallback(p), aspect: 1.6 }))
      .finally(() => {
        loading.textureLoaded(); // feeds the film-reel loader's progress
        idle(() => loadImage(p.thumbnail).then((r) => swap(entry, r), () => {}));
      });
    readyPromises.push(ready);
  }
  return e;
}

const readyPromises: Promise<unknown>[] = [];
/** all preview textures decoded (or failed) — used to time the intro */
export const texturesReady = () => Promise.all(readyPromises);

export function disposeProjectTextures() {
  cache.forEach((e) => {
    e.disposed = true;
    disposeTexture(e.texture);
  });
  cache.clear();
  readyPromises.length = 0;
}
