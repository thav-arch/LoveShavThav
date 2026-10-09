// Ported from lib/textures.ts (types stripped; logic unchanged)
import * as THREE from "three";
import { loading } from "./loading.js";
const cache = new Map();
let maxAnisotropy = 4;
export const setMaxAnisotropy = (n) => (maxAnisotropy = Math.min(8, n));
function prepare(t) {
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = maxAnisotropy;
    t.minFilter = THREE.LinearMipmapLinearFilter;
    t.generateMipmaps = true;
    t.needsUpdate = true;
    return t;
}
function fallback(p) {
    const c = document.createElement("canvas");
    c.width = 512;
    c.height = 320;
    const g = c.getContext("2d");
    g.fillStyle = "#111";
    g.fillRect(0, 0, c.width, c.height);
    g.fillStyle = p.accent;
    for (let i = 0; i < 26; i++)
        g.fillRect((i * 37) % 512, 0, 2, 320);
    g.fillStyle = "#fff";
    g.font = "600 34px system-ui, sans-serif";
    g.fillText(p.title, 24, 290);
    return prepare(new THREE.CanvasTexture(c));
}
async function loadImage(url) {
    if (!url) throw new Error("no image"); // project without a cover → generated placeholder card
    const res = await fetch(url);
    if (!res.ok)
        throw new Error(`${url}: ${res.status}`);
    const blob = await res.blob();
    if (typeof createImageBitmap === "function") {
        const bmp = await createImageBitmap(blob, { imageOrientation: "flipY" });
        const t = new THREE.Texture(bmp);
        t.flipY = false;
        return { texture: prepare(t), aspect: bmp.width / bmp.height };
    }
    const img = new Image();
    img.src = URL.createObjectURL(blob);
    await img.decode();
    return { texture: prepare(new THREE.Texture(img)), aspect: img.naturalWidth / img.naturalHeight };
}
function swap(e, next) {
    if (e.disposed)
        return next.texture.dispose();
    const old = e.texture;
    e.texture = next.texture;
    e.aspect = next.aspect;
    e.listeners.forEach((fn) => fn());
    disposeTexture(old);
}
function disposeTexture(t) {
    const img = t.image;
    t.dispose();
    if (img && typeof img.close === "function")
        img.close();
}
const idle = (fn) => "requestIdleCallback" in window ? window.requestIdleCallback(fn, { timeout: 2500 }) : setTimeout(fn, 600);
/** returns immediately with a placeholder; resolves `ready` once the preview is decoded */
export function getProjectTexture(p) {
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
            idle(() => loadImage(p.thumbnail).then((r) => swap(entry, r), () => { }));
        });
        readyPromises.push(ready);
    }
    return e;
}
const readyPromises = [];
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
