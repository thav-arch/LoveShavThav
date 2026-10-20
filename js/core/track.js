// Ported from lib/track.ts (types stripped; logic unchanged)
import * as THREE from "three";
import { INSTANCE_COUNT, mod, motion, projectAtInstance } from "./motion.js";
import { projects } from "./projects.js";
/**
 * The film strip on a diagonal (landing-page redesign, Oct 2026).
 *
 * Seen from above, the strip runs as one long diagonal, with a flat landing in the
 * middle where the current project faces the camera:
 *
 *                                   /   next projects recede into the distance
 *                                  /
 *                    ____________ /
 *                   /   centre       ← faces the camera
 *                  /
 *                 /   previous projects come toward the camera
 *
 *                       camera
 *
 *  - every frame is a flat panel; the only bends are the two folds either side of
 *    the centre frame (in the gaps between frames at rest);
 *  - scrolling slides the film ALONG this fixed path, so a frame folds as it
 *    passes a corner: flat in the middle, angled on the diagonal.
 *
 * Frames are placed by true arc length along the path (a lookup table), so
 * they keep their real width on the slopes instead of stretching.
 * The vertex shader (world/shader-card.js) samples the same table from a texture.
 */
export const BULGE = 0.035; // frames stay almost flat — the rollers do the bending
export const WAVE = 0.035; // velocity-driven travelling wave along the strip (kept small: motion comfort)
export const WAVE_FREQ = 0.85;
export const FOLD = 0.025; // velocity-driven twist of each frame (film being pulled)
export const BILLOW = 0.012; // frames puff out a little while moving fast
/** every frame on the strip has the same shape (16:9); each cover is cropped to fill it, centred, without stretching */
export const CARD_ASPECT = 16 / 9;
/** signed slot of a frame relative to the centre (0 = centre frame, negative = left / earlier projects) */
export const slotOf = (k, pos = motion.pos) => k - pos;
let model = { key: "", centers: [], widths: [], total: 1 };
/** frame centres along the strip (arc length), recomputed when content/layout change */
export function stripModel(L) {
    const key = `${INSTANCE_COUNT}|${L.cardH}|${L.gap}|${CARD_ASPECT}`;
    if (model.key === key)
        return model;
    const widths = [];
    const centers = [];
    let x = 0;
    for (let k = 0; k < INSTANCE_COUNT; k++) {
        const w = L.cardH * CARD_ASPECT;
        if (k > 0)
            x += widths[k - 1] / 2 + L.gap + w / 2;
        widths.push(w);
        centers.push(x);
    }
    const total = INSTANCE_COUNT ? x + widths[INSTANCE_COUNT - 1] / 2 + L.gap + widths[0] / 2 : 1;
    model = { key, centers, widths, total };
    return model;
}
export const frameWidth = (k, L) => stripModel(L).widths[k] ?? L.cardW;
/** arc-length position of the strip for a carousel position (in frame units) */
export function arcAt(pos, L) {
    const m = stripModel(L);
    const n = INSTANCE_COUNT;
    if (!n)
        return 0;
    const i = Math.floor(pos);
    const f = pos - i;
    const a = m.centers[mod(i, n)];
    let b = m.centers[mod(i + 1, n)];
    if (b < a)
        b += m.total;
    const laps = Math.floor(i / n) * m.total;
    return laps + a + (b - a) * f;
}
/** where frame k's centre sits along the strip, relative to the near roller */
export function frameOffset(k, arc, L) {
    const m = stripModel(L);
    // film tension: while moving, frames spread slightly away from the near roller
    return (m.centers[k] - arc) * motion.spread;
}
/* ------------------------------------------------------------ the path */
/** samples in the arc-length lookup table (also the shader texture width) */
export const PATH_N = 1024;
/** the table covers arc lengths -PATH_MAX … +PATH_MAX */
export const PATH_MAX = 40;
let path = { key: "", data: new Float32Array(PATH_N * 4) };
const ROLLERS = 16; // rollers each side of the centre frame (covers ±PATH_MAX)
const rollers = new Float64Array(ROLLERS * 2 + 2);
/**
 * Roller positions (arc length from the screen centre). Roller j sits in the
 * gap on the left of frame (centre + j), so the centre frame always runs from
 * the near roller on its left to the far roller on its right.
 *
 * Frames have different widths (cover aspect ratios), so the rollers are
 * placed on the real gaps for the frame at rest, and slide between the two
 * neighbouring rest layouts while scrolling. With equal widths this is a
 * fixed row of rollers.
 */
function placeRollers(L, pos) {
    const m = stripModel(L);
    const n = INSTANCE_COUNT;
    const i = Math.floor(pos);
    const f = pos - i;
    // left-gap of frame (c + j), measured from frame c's centre
    const gapFrom = (c, j) => {
        let s = -m.widths[mod(c, n)] / 2 - L.gap / 2;
        for (let q = 0; q < j; q++)
            s += m.widths[mod(c + q, n)] + L.gap;
        for (let q = -1; q >= j; q--)
            s -= m.widths[mod(c + q, n)] + L.gap;
        return s;
    };
    for (let j = -ROLLERS; j <= ROLLERS + 1; j++) {
        const a = n ? gapFrom(i, j) : (j - 0.5) * L.pitch;
        const b = n ? gapFrom(i + 1, j) : a;
        rollers[j + ROLLERS] = a + (b - a) * f;
    }
}
/**
 * Angle (top view) of run j — the stretch of film between roller j and j+1.
 */
function runAngle(L, j) {
    // run 0 is the centre frame: square to the camera. Every other run lies on the diagonal:
    // going right the strip moves away from the camera (z += sin(angle), so negative = away)
    return j === 0 ? 0 : -L.diag;
}
/** roller j sits between run j-1 and run j: only the two next to the centre frame actually bend the film */
const rollerRadius = (L) => L.corner;
/**
 * Heading of the film at arc length s: straight runs joined by circular arcs
 * around the rollers (the drum wraps a large part of the frames on either side).
 */
function heading(L, s) {
    // nearest roller (the array is sorted; linear scan is fine at this size)
    let j = -ROLLERS;
    let best = Infinity;
    for (let q = -ROLLERS; q <= ROLLERS + 1; q++) {
        const d = Math.abs(s - rollers[q + ROLLERS]);
        if (d < best) {
            best = d;
            j = q;
        }
    }
    const b = rollers[j + ROLLERS];
    const from = runAngle(L, j - 1);
    const to = runAngle(L, j);
    const R = rollerRadius(L);
    // the film wraps the roller evenly (constant curvature). When the strip turns
    // from coming forward to receding, the crest (heading 0) sits exactly on the
    // gap, so the wrap reaches |from|·R to the left and |to|·R to the right.
    const crest = from * to < 0;
    const left = crest ? Math.abs(from) * R : (Math.abs(to - from) * R) / 2;
    const right = crest ? Math.abs(to) * R : left;
    if (s > b - left && s < b + right)
        return from + ((to - from) * (s - b + left)) / (left + right);
    return s < b ? from : to;
}
/**
 * Arc-length lookup table: for evenly spaced arc lengths s, the point (x, z)
 * on the zig-zag and its normal (nx, nz) facing the camera. 4 floats / sample.
 * Rebuilt while the strip moves (rollers follow the frame gaps), cached at rest.
 */
export function pathModel(L, pos = motion.pos) {
    const at = Math.abs(pos - Math.round(pos)) < 1e-4 ? Math.round(pos) : pos;
    const key = `${stripModel(L).key}|${L.diag}|${L.corner}|${mod(Math.floor(at), INSTANCE_COUNT || 1)}|${(at - Math.floor(at)).toFixed(4)}`;
    if (path.key === key)
        return path;
    placeRollers(L, at);
    const step = (2 * PATH_MAX) / (PATH_N - 1);
    const sub = 4; // integration sub-steps per table sample
    const data = new Float32Array(PATH_N * 4);
    const mid = (PATH_N - 1) / 2;
    const write = (i, x, z, s) => {
        const phi = heading(L, s);
        data[i * 4] = x;
        data[i * 4 + 1] = z;
        data[i * 4 + 2] = -Math.sin(phi); // normal facing the camera (+z)
        data[i * 4 + 3] = Math.cos(phi);
    };
    // integrate outward from s = 0 in both directions, recording the point at every sample's exact
    // arc length (s_i = -PATH_MAX + i·step), so all PATH_N samples are filled
    for (const dir of [1, -1]) {
        let x = 0;
        let z = 0;
        let s = 0;
        const first = dir > 0 ? Math.ceil(mid) : Math.floor(mid);
        for (let i = first; i >= 0 && i < PATH_N; i += dir) {
            const target = -PATH_MAX + i * step;
            const n = Math.max(1, Math.ceil((Math.abs(target - s) * sub) / step));
            const ds = (target - s) / n;
            for (let k = 0; k < n; k++) {
                const phi = heading(L, s + ds / 2);
                x += Math.cos(phi) * ds;
                z += Math.sin(phi) * ds;
                s += ds;
            }
            write(i, x, z, s);
        }
    }
    // the centre frame sits at z = 0, square to the camera (no depth offset needed)
    path = { key, data };
    return path;
}
const tmp = { x: 0, z: 0, nx: 0, nz: 1 };
/** point + normal on the path at arc length s (linear interpolation of the table) */
export function pathAt(s, L) {
    const { data } = pathModel(L);
    const f = THREE.MathUtils.clamp((s + PATH_MAX) / (2 * PATH_MAX), 0, 1) * (PATH_N - 1);
    const i = Math.min(Math.floor(f), PATH_N - 2);
    const t = f - i;
    const a = i * 4;
    const b = a + 4;
    tmp.x = data[a] + (data[b] - data[a]) * t;
    tmp.z = data[a + 1] + (data[b + 1] - data[a + 1]) * t;
    tmp.nx = data[a + 2] + (data[b + 2] - data[a + 2]) * t;
    tmp.nz = data[a + 3] + (data[b + 3] - data[a + 3]) * t;
    return tmp;
}
/* ------------------------------------------------------------- geometry */
/** world position of a point at arc `u`, height `y`, pushed `d` along the path normal */
export function trackPoint(out, u, y, d, L) {
    const p = pathAt(u, L);
    return out.set(p.x + p.nx * d, y, p.z + p.nz * d);
}
/** sheet displacement: frame bulge + travelling wave + per-frame twist while moving */
export function sheetDisplacement(u, nx, lx, vel) {
    return (BULGE + BILLOW * Math.abs(vel)) * (1 - nx * nx) + vel * WAVE * Math.sin(u * WAVE_FREQ + 0.6) + vel * FOLD * lx;
}
/**
 * Ray / strip picking: intersect the ray (seen from above) with the path's
 * polyline, keep the nearest hit, then find which frame covers that arc
 * length and height. No mesh raycasting against displaced vertices.
 */
export function pickCard(ray, L, maxSlot = L.maxSlot) {
    const { data } = pathModel(L);
    const { x: ox, y: oy, z: oz } = ray.origin;
    const { x: dx, y: dy, z: dz } = ray.direction;
    const step = (2 * PATH_MAX) / (PATH_N - 1);
    const hits = []; // [t, s] for every place the ray crosses the strip (seen from above)
    for (let i = 0; i < PATH_N - 1; i++) {
        const ax = data[i * 4];
        const az = data[i * 4 + 1];
        const ex = data[i * 4 + 4] - ax;
        const ez = data[i * 4 + 5] - az;
        // solve o + t·d = a + q·e   (2D, in the xz plane)
        const den = dx * ez - dz * ex;
        if (Math.abs(den) < 1e-12)
            continue;
        const wx = ax - ox;
        const wz = az - oz;
        const t = (wx * ez - wz * ex) / den;
        const q = (wx * dz - wz * dx) / den;
        if (t > 0 && q >= 0 && q <= 1)
            hits.push([t, -PATH_MAX + (i + q) * step]);
    }
    hits.sort((a, b) => a[0] - b[0]);
    const arc = motion.arc;
    for (const [t, hitS] of hits) {
        const hy = oy + dy * t;
        const lv = (hy - L.cardY) / L.cardH;
        if (Math.abs(lv) > 0.5)
            continue;
        for (let k = 0; k < INSTANCE_COUNT; k++) {
            const slot = slotOf(k);
            if (slot > maxSlot || slot < -L.maxLeft)
                continue;
            const lu = (hitS - frameOffset(k, arc, L)) / frameWidth(k, L);
            if (Math.abs(lu) <= 0.5)
                return { k, slot, u: lu + 0.5, v: lv + 0.5 };
        }
    }
    return null;
}
