// Ported from lib/layout.ts (types stripped; logic unchanged)
export function computeLayout(width, height) {
    const aspect = width / Math.max(1, height);
    const device = width < 700 ? "mobile" : width < 1100 || aspect < 1.15 ? "tablet" : "desktop";
    // a wider lens, closer in: the near fold looms and the far fold falls away
    // (centre frame's far edge ≈ 60% of its near edge, like a dolly-in shot)
    const fov = device === "mobile" ? 50 : 58;
    const cardW = 3.2;
    const cardH = 2.0;
    const t = Math.tan((fov * Math.PI) / 360);
    const base = {
        // fill: share of the screen height the centre frame takes; widthShare: of the width
        // fog: starts fogStart behind the front frame and is complete fogSpan further
        desktop: { gap: 0.14, fold: 0.9, farFold: 0.24, drum: 1.45, roller: 0.62, dolly: 0.74, fill: 0.58, widthShare: 0.48, fogStart: 2.6, fogSpan: 12, maxSlot: 3.4, parallax: 1 },
        tablet: { gap: 0.14, fold: 0.84, farFold: 0.22, drum: 1.25, roller: 0.55, dolly: 0.76, fill: 0.5, widthShare: 0.62, fogStart: 2.4, fogSpan: 9, maxSlot: 2.6, parallax: 0.6 },
        mobile: { gap: 0.12, fold: 0.8, farFold: 0.2, drum: 0.95, roller: 0.45, dolly: 0.86, fill: 0.42, widthShare: 0.86, fogStart: 2.2, fogSpan: 7, maxSlot: 1.9, parallax: 0.25 },
    }[device];
    // camera distance: card height fills `fill` of the viewport height,
    // pulled back further when the viewport is narrow so the active card fits
    const fitHeight = cardH / base.fill / (2 * t);
    const fitWidth = cardW / base.widthShare / (2 * t * aspect);
    // dolly: then move in closer than the flat fit — the folded frames are
    // foreshortened, and the short distance is what gives the strong depth
    const camZ = Math.max(fitHeight, fitWidth) * base.dolly;
    const pitch = cardW + base.gap;
    return {
        device,
        fov,
        cardW,
        cardH,
        gap: base.gap,
        pitch,
        fold: base.fold,
        farFold: base.farFold,
        drum: base.drum,
        roller: base.roller,
        cardY: 0.12,
        floorY: -1.5,
        camY: 0.42,
        camZ,
        lookY: 0.02,
        fogNear: camZ + base.fogStart,
        fogFar: camZ + base.fogStart + base.fogSpan,
        maxSlot: base.maxSlot,
        damping: device === "desktop" ? 6.5 : 8,
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
