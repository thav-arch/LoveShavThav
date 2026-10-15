// Landing intro, driven by scroll (storyboard Oct 2026 + the portal reference video):
//   1. pieces of work drift in from the dark and float, scattered in depth, around the name
//   2. with every scroll they lift, resize and relocate — each on its own curved path, with its own weight
//   3. they gather into a ring around the name
//   4. a vortex opens inside the ring, the ring spins up and the pieces fall in one after another
//   5. the camera dives through the vortex and its dark core spreads to black
//   6. on the black, a few lines appear one at a time — the first ones messy, scattered letters, each next
//      one more ordered — then the page hands over to the "Welcome to my portfolio" screen (js/main.js)
//
// Web-friendly by design: cards move with transforms / opacity only (CSS 3D), images are small (≈20 KB
// each), the vortex is ONE small WebGL canvas drawn at reduced resolution and only while it is visible,
// and the whole thing is removed from the page when it ends. Scrolling is native (touch momentum,
// keyboard, scrollbar) and smoothed with Lenis for wheels. Plays once per browser session; "Skip intro"
// ends it; visitors who prefer reduced motion never see it (see the small script in index.html's <head>).

const gsap = window.gsap;
const SEEN = "intro-seen";
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const smooth = (a, b, v) => {
  const t = clamp((v - a) / (b - a));
  return t * t * (3 - 2 * t);
};
const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const easeOut = (t) => 1 - Math.pow(1 - t, 3);
const easeIn = (t) => t * t * t;
const mix = (a, b, t) => a + (b - a) * t;

// The two scattered layouts from the storyboard (frame 1, frame 2), in the storyboard's 643 × 378 units:
// centre x, centre y, width, height, tilt (deg). Card i of SCATTER moves to card i of DRIFT.
const SCATTER = [
  [75, 90, 150, 180, -3], [172, 94, 41, 96, 4], [595, 52, 96, 103, 2], [580, 216, 99, 69, -4],
  [194, 280, 98, 68, 3], [43, 344, 86, 68, -2], [392, 350, 98, 55, 2], [600, 347, 86, 61, -3],
];
const DRIFT = [
  [125, 94, 138, 96, 2], [382, 71, 185, 142, -2], [591, 131, 104, 137, 3], [545, 272, 99, 69, -2],
  [144, 288, 99, 68, -3], [55, 194, 110, 96, 2], [295, 344, 98, 68, 3], [425, 350, 98, 55, -2],
];
const SB_W = 643;
const SB_H = 378;
// per-card character, so they never move in lockstep: depth while scattered / drifted (px toward the
// viewer), resting 3D tilt (deg), how "heavy" each one is (spring rate), and how far its path bows
const DEPTH_A = [-80, 70, -220, 120, -40, 160, -160, 40];
const DEPTH_B = [50, -120, 90, -30, 140, -90, 60, -180];
const TILT = [[6, -10], [-8, 12], [4, 9], [-6, -8], [10, 6], [-4, -12], [8, -6], [-10, 10]];
const RATE = [7.5, 10.5, 8.5, 12, 9, 11, 7, 10]; // higher = lighter / quicker to settle
const BOW = [70, -90, 60, -50, 100, -70, 80, -60]; // sideways bulge of each path (storyboard units)

// scroll timeline (0 → 1 over the intro's scroll length): the portal part, then the lines
const T = { hold: 0.045, drift: 0.17, ring: 0.29, open: 0.345, pull: 0.48 };
const DIVE_END = 0.55; // the vortex has faded to black
const LINES = [0.57, 0.975]; // the story lines play between these points

export function startIntro({ profile, images, lines = [], onDone }) {
  const html = document.documentElement;
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (!html.hasAttribute("data-intro") || reduced) {
    html.removeAttribute("data-intro");
    onDone({ skipped: true }); // no intro this time (already seen, or reduced motion): straight to the strip, no welcome
    return;
  }

  /* ---------------------------------------------------------------- DOM */
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
  const scroller = document.createElement("section");
  scroller.className = "intro";
  scroller.tabIndex = -1;
  scroller.setAttribute("aria-label", "Introduction — scroll to continue");
  scroller.innerHTML = `<div class="intro-track"></div>`;
  const stage = document.createElement("div");
  stage.className = "intro-stage";
  const n = SCATTER.length;
  stage.innerHTML = `
    <canvas class="intro-vortex" aria-hidden="true"></canvas>
    <div class="intro-vortex-css" aria-hidden="true"></div>
    <div class="intro-cards" aria-hidden="true">${Array.from({ length: n }, (_, i) => `<figure class="ic"><img src="${esc(images[i % images.length])}" alt="" decoding="async"></figure>`).join("")}</div>
    <div class="intro-text">
      <h1 class="it-name">${esc(profile.name)}</h1>
      <p class="it-roles">${profile.roles.map((r) => `<span>${esc(r)}</span>`).join("")}</p>
      <p class="it-line">${esc(profile.intro)}</p>
    </div>
    <div class="intro-story">${lines.map((l) => `<p class="is-line">${l.split(" ").map((w) => `<span class="w">${[...w].map((ch) => `<span class="ch">${esc(ch)}</span>`).join("")}</span>`).join(" ")}</p>`).join("")}</div>
    <div class="intro-hint" aria-hidden="true"><span>Scroll</span><i></i></div>
    <button class="intro-skip" type="button">Skip intro</button>`;
  document.body.append(scroller, stage);
  const cards = [...stage.querySelectorAll(".ic")];
  const text = stage.querySelector(".intro-text");
  const line = stage.querySelector(".it-line");
  const hint = stage.querySelector(".intro-hint");
  const cssVortex = stage.querySelector(".intro-vortex-css");
  // the story lines: every letter gets its own scatter (seeded, so it is the same on every visit)
  const story = [...stage.querySelectorAll(".is-line")].map((el, j, all) => {
    const mess = all.length > 1 ? 1 - j / (all.length - 1) : 0; // first line the messiest, last line orderly
    const letters = [...el.querySelectorAll(".ch")].map((ch, q) => {
      const r = (m) => {
        const x = Math.sin((j + 1) * 12.9898 + q * 78.233 + m * 37.719) * 43758.5453;
        return (x - Math.floor(x)) * 2 - 1;
      };
      return { ch, dx: r(1) * 120, dy: r(2) * 70, rot: r(3) * 50 };
    });
    return { el, mess, letters, on: false };
  });
  scroller.focus({ preventScroll: true });

  /* ------------------------------------------------------- smooth scroll */
  let lenis = null;
  if (window.Lenis) lenis = new window.Lenis({ wrapper: scroller, content: scroller.firstElementChild, lerp: 0.085, smoothWheel: true });

  /* --------------------------------------------------- vortex (WebGL) */
  const vortex = createVortex(stage.querySelector(".intro-vortex"));
  if (!vortex) cssVortex.style.display = "block"; // no WebGL: a soft CSS glow stands in

  /* ------------------------------------------------------------- layout */
  let W = 0;
  let H = 0;
  let k = 1; // size scale from the storyboard
  let ring = null;
  const layout = () => {
    W = innerWidth;
    H = innerHeight;
    k = Math.sqrt(W * H) / Math.sqrt(SB_W * SB_H);
    const ry = Math.min(H * 0.3, W * 0.34);
    const rx = Math.min(ry * 1.18, W * 0.42);
    const cw = ry * 0.78;
    // ring slots follow the cards' angular order in the drift layout, so nobody crosses paths
    const order = DRIFT.map((d, i) => [Math.atan2(d[0] - SB_W / 2, -(d[1] - SB_H / 2)), i]).sort((a, b) => a[0] - b[0]);
    const slot = [];
    order.forEach(([, i], j) => (slot[i] = (j / n) * Math.PI * 2));
    ring = { rx, ry, cw, ch: cw * 0.62, slot };
    vortex?.resize(W, H);
  };
  layout();
  addEventListener("resize", layout);
  const fromSB = ([x, y, w, h, r]) => ({ x: (x / SB_W - 0.5) * W, y: (y / SB_H - 0.5) * H, w: w * k, h: h * k, r });

  // the pointer gently parallaxes the floating pieces (nearer ones move more)
  const pointer = { x: 0, y: 0, sx: 0, sy: 0 };
  const onPointer = (e) => {
    pointer.x = (e.clientX / W) * 2 - 1;
    pointer.y = (e.clientY / H) * 2 - 1;
  };
  addEventListener("pointermove", onPointer, { passive: true });

  /* ------------------------------------------------- pose of each piece */
  // displayed pose: follows the scroll-driven target through a spring per card (organic, a little lag)
  const KEYS = ["x", "y", "z", "w", "h", "rx", "ry", "rz", "o", "tint"];
  const pose = cards.map(() => Object.fromEntries(KEYS.map((key) => [key, 0])));
  const vel = cards.map(() => Object.fromEntries(KEYS.map((key) => [key, 0])));
  const entered = new Array(n).fill(false);
  let first = true;

  // target pose of card i at scroll progress p and time `time` (s since start)
  const target = (i, p, time) => {
    const a = fromSB(SCATTER[i]);
    const b = fromSB(DRIFT[i]);
    const stagger = i * 0.018;
    const span = 1 + 7 * 0.018;
    const tD = easeInOut(clamp(smooth(T.hold, T.drift, p) * span - stagger));
    const tR = easeInOut(clamp(smooth(T.drift - 0.03, T.ring, p) * span - (7 - i) * 0.018));

    // scattered → drifted, along a bowed path (perpendicular bulge peaks mid-way)
    const bow = (from, to, t, amount) => {
      const dx = to.x - from.x;
      const dy = to.y - from.y;
      const len = Math.hypot(dx, dy) || 1;
      const b = Math.sin(Math.PI * t) * amount * k;
      return { x: mix(from.x, to.x, t) - (dy / len) * b, y: mix(from.y, to.y, t) + (dx / len) * b };
    };
    const ab = bow(a, b, tD, BOW[i]);
    let w = mix(a.w, b.w, tD);
    let h = mix(a.h, b.h, tD);
    let z = mix(DEPTH_A[i], DEPTH_B[i], tD) + Math.sin(Math.PI * tD) * 90; // lifts toward you mid-flight
    let rz = mix(a.r, b.r, tD);
    let rx = TILT[i][0];
    let ry = TILT[i][1];

    // drifted → ring (also bowed, the other way)
    const spinHold = smooth(T.ring, T.open, p) * 0.1; // slow turn once the ring is formed (turns)
    const pull = smooth(T.open, T.pull, p);
    const spinPull = Math.pow(pull, 1.7) * 0.9;
    const th = ring.slot[i] + (spinHold + spinPull) * Math.PI * 2;
    const base = (ring.slot[i] * 180) / Math.PI;
    const upright = base - 180 * Math.round(base / 180); // folded into ±90°, so no card is upside down
    const c = { x: Math.sin(th) * ring.rx, y: -Math.cos(th) * ring.ry, w: ring.cw, h: ring.ch, r: upright + (spinHold + spinPull) * 360 };
    const br = bow(ab, c, tR, -BOW[i] * 0.6);
    let x = br.x;
    let y = br.y;
    w = mix(w, c.w, tR);
    h = mix(h, c.h, tR);
    z = mix(z, 0, tR);
    rz = mix(rz, c.r - 360 * Math.round((c.r - rz) / 360), tR);
    rx = mix(rx, 0, tR);
    ry = mix(ry, 0, tR);

    // weightless float while scattered: two slow, unrelated waves per axis (reads as drift, not wobble)
    const fl = 1 - tR;
    const f = 0.32 + 0.05 * i;
    x += (Math.sin(time * f + i * 1.9) * 7 + Math.sin(time * f * 0.53 + i * 4.1) * 5) * k * fl;
    y += (Math.cos(time * f * 0.87 + i * 2.7) * 8 + Math.sin(time * f * 0.41 + i * 0.7) * 5) * k * fl;
    z += Math.sin(time * f * 0.6 + i) * 40 * fl;
    rx += Math.sin(time * f * 0.7 + i * 2.1) * 5 * fl;
    ry += Math.cos(time * f * 0.6 + i * 1.3) * 7 * fl;
    rz += Math.sin(time * f * 0.5 + i) * 1.8 * fl;
    // pointer parallax: nearer pieces move more
    const depth = 1 + z / 260;
    x += pointer.sx * 22 * depth * fl;
    y += pointer.sy * 14 * depth * fl;

    // falling in, one after another: spiral faster as it nears the centre, tip edge-on, sink into depth
    const g = clamp((pull - i * 0.065) / (1 - 7 * 0.065));
    const ge = easeIn(g);
    let o = 1;
    let tint = smooth(T.ring - 0.05, T.open, p) * 0.15;
    if (g > 0) {
      const extra = ge * Math.PI * 1.6; // extra turn while being swallowed
      const rr = 1 - ge;
      const ang = th + extra;
      x = mix(x, Math.sin(ang) * ring.rx * rr, ge);
      y = mix(y, -Math.cos(ang) * ring.ry * rr, ge);
      z = -1100 * ge;
      rz += (extra * 180) / Math.PI;
      ry = 72 * ge * (i % 2 ? -1 : 1);
      rx = 18 * ge;
      tint = mix(tint, 0.85, smooth(0, 0.7, g));
      o = 1 - smooth(0.62, 0.95, g);
    }

    // arrival on load: each piece drifts in from the dark, one after another
    const e = easeOut(clamp((time - 0.1 - i * 0.11) / 1.6));
    if (e < 1) {
      z = mix(-900, z, e);
      rz = mix(rz + (i % 2 ? 24 : -24), rz, e);
      o *= e;
    }
    return { x, y, z, w, h, rx, ry, rz, o, tint, g };
  };

  /* --------------------------------------------------------------- frame */
  let p = 0; // smoothed progress
  let forced = null; // set while the ending plays by itself
  let raf = 0;
  const t0 = performance.now();
  let last = t0;
  let pulse = 0;
  let finishing = false;
  let done = false;

  const frame = (now) => {
    lenis?.raf(now); // Lenis only moves the scroller when it is ticked every frame
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    const time = (now - t0) / 1000;
    const max = scroller.scrollHeight - scroller.clientHeight;
    const raw = forced ?? (max > 0 ? scroller.scrollTop / max : 0);
    p = forced != null ? raw : p + (raw - p) * (1 - Math.exp(-dt * 9));
    pointer.sx += (pointer.x - pointer.sx) * (1 - Math.exp(-dt * 3));
    pointer.sy += (pointer.y - pointer.sy) * (1 - Math.exp(-dt * 3));

    cards.forEach((el, i) => {
      const tg = target(i, p, time);
      const ps = pose[i];
      const vs = vel[i];
      if (first) Object.assign(ps, tg);
      else {
        // critically damped spring per property: settles without overshoot, at this card's own pace
        const w0 = RATE[i];
        for (const key of KEYS) {
          const acc = (tg[key] - ps[key]) * w0 * w0 - 2 * w0 * vs[key];
          vs[key] += acc * dt;
          ps[key] += vs[key] * dt;
        }
      }
      // a piece reaching the centre sends a pulse through the vortex
      if (!entered[i] && tg.g > 0.9) {
        entered[i] = true;
        pulse = 1;
      } else if (entered[i] && tg.g < 0.5) entered[i] = false;

      el.style.width = `${Math.max(1, ps.w)}px`;
      el.style.height = `${Math.max(1, ps.h)}px`;
      el.style.transform = `translate3d(${W / 2 + ps.x - ps.w / 2}px, ${H / 2 + ps.y - ps.h / 2}px, ${ps.z}px) rotateX(${ps.rx}deg) rotateY(${ps.ry}deg) rotateZ(${ps.rz}deg)`;
      el.style.opacity = String(clamp(ps.o));
      el.style.setProperty("--glow", String(smooth(T.ring - 0.04, T.open, p) * (1 - smooth(T.open, T.pull, p))));
      el.style.setProperty("--tint", String(clamp(ps.tint)));
    });
    first = false;
    pulse *= Math.exp(-dt * 2.6);

    // text: name + roles from the start, the intro line joins as the pieces drift, all fade as the portal opens
    const toRing = smooth(T.drift - 0.03, T.ring, p);
    text.style.opacity = String(1 - smooth(T.ring + 0.01, T.open + 0.01, p));
    text.style.transform = `translate3d(-50%, -50%, 0) scale(${1 - 0.42 * toRing})`;
    line.style.opacity = String(smooth(T.hold, T.hold + 0.12, p));
    hint.style.opacity = String(1 - smooth(0.01, 0.06, p));

    // vortex: opens inside the ring, grows while pulling in, then fills the screen and fades to black
    const open = smooth(T.ring - 0.06, T.open, p);
    const pull = smooth(T.open, T.pull, p);
    const dive = smooth(T.pull - 0.02, DIVE_END, p);
    const size = open * (1 + 0.3 * pull) + 7 * Math.pow(dive, 2.2);
    const bright = open * (1 - smooth(0.3, 0.97, dive));
    if (vortex) vortex.draw(time, size, bright, pull, pulse, dive);
    else {
      cssVortex.style.opacity = String(bright);
      cssVortex.style.transform = `translate(-50%, -50%) scale(${0.2 + size}) rotate(${time * 40}deg)`;
    }

    // the story: one line at a time; letters fly from their scatter into place (more scatter for early lines)
    const nL = story.length;
    const local = nL ? ((p - LINES[0]) / (LINES[1] - LINES[0])) * nL : -1;
    story.forEach((L, j) => {
      const t = local - j; // 0 → 1 while this line is current
      const visible = t > -0.05 && (t < 1.05 || j === nL - 1);
      if (!visible) {
        if (L.on) {
          L.el.style.opacity = "0";
          L.on = false;
        }
        return;
      }
      L.on = true;
      const inn = smooth(0, 0.42, t);
      const out = j === nL - 1 ? 0 : smooth(0.72, 1, t);
      const settle = easeOut(clamp(t / 0.55));
      L.el.style.opacity = String(inn * (1 - out));
      L.el.style.transform = `translate3d(-50%, calc(-50% + ${(1 - inn) * 18 - out * 26}px), 0)`;
      // messy lines keep a little restlessness even once assembled
      const spread = Math.max(0, L.mess * (1 - settle) + 0.06 * L.mess * Math.sin(time * 0.8 + j));
      for (const c of L.letters) {
        c.ch.style.transform = spread > 0.001 ? `translate3d(${c.dx * spread}px, ${c.dy * spread}px, 0) rotate(${c.rot * spread}deg)` : "";
      }
    });

    if (!finishing && p > 0.985) finish(false);
    raf = requestAnimationFrame(frame);
  };
  raf = requestAnimationFrame(frame);

  /* ---------------------------------------------------------------- end */
  function finish(skip) {
    if (finishing) return;
    finishing = true;
    lenis?.stop();
    scroller.style.overflow = "hidden";
    const end = () => {
      if (done) return;
      done = true;
      try {
        sessionStorage.setItem(SEEN, "1");
      } catch {}
      html.removeAttribute("data-intro");
      onDone({ skipped: skip }); // js/main.js shows the welcome screen (or, when skipped, the strip)
      gsap.to(stage, {
        opacity: 0,
        duration: skip ? 0.5 : 0.8,
        ease: "power2.out",
        onComplete: () => {
          cancelAnimationFrame(raf);
          removeEventListener("resize", layout);
          removeEventListener("pointermove", onPointer);
          lenis?.destroy();
          vortex?.dispose();
          scroller.remove();
          stage.remove();
        },
      });
    };
    if (skip) return end();
    const s = { p };
    forced = p;
    gsap.to(s, { p: 1, duration: 0.5, ease: "power1.out", onUpdate: () => (forced = s.p), onComplete: end });
  }
  stage.querySelector(".intro-skip").addEventListener("click", () => finish(true));
  addEventListener("keydown", function onEsc(e) {
    if (e.key !== "Escape" || done) return;
    removeEventListener("keydown", onEsc);
    finish(true);
  });
}

/* ------------------------------------------------------------------ vortex */
// One fragment shader on a small canvas (≈55% of the screen resolution: it is soft by nature).
// A log-spiral tunnel: two layers of swirling streaks flowing inward, a dark deep-blue core, a thin bright
// rim with twinkling shards (the glowing stones of the reference), a halo, a light pulse when a piece falls
// in, and an inward rush that speeds up as the camera dives through.
function createVortex(canvas) {
  const gl = canvas.getContext("webgl", { alpha: true, premultipliedAlpha: true, antialias: false, depth: false });
  if (!gl) return null;
  const vs = `attribute vec2 p; void main(){ gl_Position = vec4(p, 0.0, 1.0); }`;
  const fs = `precision mediump float;
uniform vec2 uRes; uniform float uTime, uSize, uBright, uPull, uPulse, uDive;
const float TAU = 6.2831853;
float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y); }
float fbm(vec2 p){ float v = 0.0, a = 0.5; for (int i = 0; i < 4; i++){ v += a * noise(p); p = p * 2.03 + 1.7; a *= 0.5; } return v; }
void main(){
  vec2 uv = (gl_FragCoord.xy - 0.5 * uRes) / min(uRes.x, uRes.y);
  float R = 0.3 * max(uSize, 0.001);
  float rn = length(uv) / R;
  float ang = atan(uv.y, uv.x);
  float lr = log(max(rn, 0.001));
  // inward flow: slow while it opens, rushing during the dive
  float flow = uTime * (0.32 + uPull * 0.5 + uDive * 3.0);
  float tw = ang + lr * 1.7 - uTime * 0.55 - uPull * 5.0;                 // log spiral, turning
  float n1 = fbm(vec2(cos(tw), sin(tw)) * 1.6 + vec2(lr * 2.4 - flow, 0.0));
  float tw2 = tw * 2.0 + 1.3;
  float n2 = fbm(vec2(cos(tw2), sin(tw2)) * 2.3 + vec2(lr * 3.6 - flow * 1.35, 4.1));
  float arms = n1 * 0.62 + n2 * 0.48;
  float streak = smoothstep(0.42, 0.92, arms);
  float hot = pow(streak, 2.4);
  // radial profile
  float body = smoothstep(1.1, 0.6, rn);
  float core = smoothstep(0.62, 0.0, rn);
  float rim = exp(-pow((rn - 1.0) / 0.06, 2.0));
  // shards: a ring of small bright cells just outside the rim, twinkling
  float cells = 56.0;
  float cpos = (ang / TAU + 0.5) * cells + uTime * 0.15;
  float cid = floor(cpos);
  float roundish = smoothstep(0.5, 0.12, abs(fract(cpos) - 0.5));   // soft round sparks, not bars
  float on = step(0.7, hash(vec2(cid, 7.0)));
  float tw3 = 0.55 + 0.45 * sin(uTime * (3.0 + 4.0 * hash(vec2(cid, 2.0))) + cid);
  float shard = on * tw3 * roundish * exp(-pow((rn - 1.07 - 0.05 * hash(vec2(cid, 5.0))) / 0.035, 2.0));
  vec3 navy = vec3(0.01, 0.03, 0.2), royal = vec3(0.07, 0.2, 0.95), sky = vec3(0.45, 0.68, 1.0), white = vec3(0.94, 0.97, 1.0);
  vec3 col = mix(navy, royal, smoothstep(0.25, 0.85, arms));
  col = mix(col, sky, streak * 0.85);
  col = mix(col, white, hot * smoothstep(0.12, 0.8, rn));
  col = mix(col, navy * 0.55, core * 0.95);
  col *= body;
  col += vec3(0.55, 0.76, 1.0) * rim * 0.95 + vec3(0.65, 0.88, 1.0) * shard * 1.5;
  float halo = exp(-max(rn - 1.0, 0.0) * 2.6) * smoothstep(2.1, 1.0, rn) * 0.5;
  col += vec3(0.14, 0.3, 1.0) * halo;
  // a ring of light travelling inward each time a piece falls in
  float wave = exp(-pow((rn - (1.0 - uPulse * 0.85)) / 0.1, 2.0)) * uPulse;
  col += vec3(0.6, 0.82, 1.0) * wave * 0.9;
  float alpha = clamp(body + rim + halo + shard + wave, 0.0, 1.0) * uBright;
  gl_FragColor = vec4(col * uBright, alpha);
}`;
  const sh = (type, src) => {
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      console.warn("Intro vortex shader:", gl.getShaderInfoLog(s));
      return null;
    }
    return s;
  };
  const v = sh(gl.VERTEX_SHADER, vs);
  const f = sh(gl.FRAGMENT_SHADER, fs);
  if (!v || !f) return null;
  const prog = gl.createProgram();
  gl.attachShader(prog, v);
  gl.attachShader(prog, f);
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return null;
  gl.useProgram(prog);
  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(prog, "p");
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  const u = (name) => gl.getUniformLocation(prog, name);
  const U = { res: u("uRes"), time: u("uTime"), size: u("uSize"), bright: u("uBright"), pull: u("uPull"), pulse: u("uPulse"), dive: u("uDive") };
  const SCALE = 0.55;
  let cleared = true;
  return {
    resize(w, h) {
      canvas.width = Math.max(2, Math.round(w * SCALE));
      canvas.height = Math.max(2, Math.round(h * SCALE));
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.uniform2f(U.res, canvas.width, canvas.height);
    },
    draw(time, size, bright, pull, pulse, dive) {
      if (bright < 0.002) {
        // nothing to show: clear once and stop drawing
        if (!cleared) {
          gl.clearColor(0, 0, 0, 0);
          gl.clear(gl.COLOR_BUFFER_BIT);
          cleared = true;
        }
        return;
      }
      cleared = false;
      gl.uniform1f(U.time, time);
      gl.uniform1f(U.size, size);
      gl.uniform1f(U.bright, bright);
      gl.uniform1f(U.pull, pull);
      gl.uniform1f(U.pulse, pulse);
      gl.uniform1f(U.dive, dive);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    },
    dispose() {
      gl.getExtension("WEBGL_lose_context")?.loseContext();
    },
  };
}
