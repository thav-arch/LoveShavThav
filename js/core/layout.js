// Ported from lib/layout.ts (types stripped; logic unchanged)
export function computeLayout(width, height) {
    const aspect = width / Math.max(1, height);
    const device = width < 700 ? "mobile" : width < 1100 || aspect < 1.15 ? "tablet" : "desktop";
    // a longer lens from further back: the centre frame reads flat and square-on, while the
    // diagonal either side still shows clear depth (previous frames toward you, next ones away)
    const cardW = 3.2;
    const cardH = 2.0;
    const base = {
        // fill: share of the screen height the centre frame takes; widthShare: of the width
        // fog: starts fogStart behind the front frame and is complete fogSpan further
        // diag: angle (radians, seen from above) of the frames either side of the centre frame
        // corner: radius of the two folds next to the centre frame
        // maxSlot / maxLeft: how many frames show to the right (receding) / left (coming toward you)
        desktop: { fov: 32, gap: 0.14, diag: 0.92, corner: 0.32, dolly: 1, fill: 0.52, widthShare: 0.56, fogStart: 3.5, fogSpan: 16, maxSlot: 3.4, maxLeft: 1.7, parallax: 0.35 },
        tablet: { fov: 36, gap: 0.14, diag: 0.88, corner: 0.3, dolly: 1, fill: 0.46, widthShare: 0.66, fogStart: 3.2, fogSpan: 12, maxSlot: 2.8, maxLeft: 1.6, parallax: 0.25 },
        mobile: { fov: 42, gap: 0.12, diag: 0.84, corner: 0.26, dolly: 1, fill: 0.4, widthShare: 0.74, fogStart: 3, fogSpan: 9, maxSlot: 2.2, maxLeft: 1.5, parallax: 0.1 },
    }[device];
    const fov = base.fov;
    const t = Math.tan((fov * Math.PI) / 360);
    // camera distance: card height fills `fill` of the viewport height,
    // pulled back further when the viewport is narrow so the active card fits
    const fitHeight = cardH / base.fill / (2 * t);
    const fitWidth = cardW / base.widthShare / (2 * t * aspect);
    // dolly < 1 would move in closer than the flat fit (the centre frame now faces the camera, so 1 = exact fit)
    const camZ = Math.max(fitHeight, fitWidth) * base.dolly;
    const pitch = cardW + base.gap;
    return {
        device,
        fov,
        cardW,
        cardH,
        gap: base.gap,
        pitch,
        diag: base.diag,
        corner: base.corner,
        cardY: 0.12,
        floorY: -1.5,
        camY: 0.42,
        camZ,
        lookY: 0.02,
        fogNear: camZ + base.fogStart,
        fogFar: camZ + base.fogStart + base.fogSpan,
        maxSlot: base.maxSlot,
        maxLeft: base.maxLeft,
        // how quickly the strip glides to its target (lower = smoother, longer glide)
        damping: device === "desktop" ? 5 : 6,
        parallax: base.parallax,
    };
}
/** visible world height at a given distance from the camera */
export const visibleHeight = (fov, dist) => 2 * dist * Math.tan((fov * Math.PI) / 360);
/** unit ring: centre-line radius 1, tube radius PORTAL_TUBE */
export const PORTAL_TUBE = 0.15;
/**
 * Portal size and placement. The ring is held at a fixed distance in front of
 * the camera and fills most of the viewport height; on portrait screens it is
 * width-limited and stretched vertically into a tall lens so the profile
 * still fits inside it.
 */
export function portalMetrics(L, aspect) {
    // well in front of the nearest fold (the camera sits close to the reel)
    const dist = Math.min(3.2, L.camZ * 0.5);
    const vh = visibleHeight(L.fov, dist);
    const vw = vh * aspect;
    const outer = 1 + PORTAL_TUBE;
    let sy = (vh * 0.43) / outer;
    let sx = sy;
    if (vw < vh * 1.12) {
        sx = (vw * 0.46) / outer;
        sy = Math.min(sy, sx * 1.75);
    }
    // radius of the ring projected onto the z = 0 plane (front of the arc)
    const voidR = ((sx * outer) * L.camZ) / dist;
    return { dist, sx, sy, voidR };
}
