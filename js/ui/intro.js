// Landing intro, driven by scroll (storyboard Oct 2026 + the portal reference video):
//   1. pieces of work float scattered on black around the name
//   2. with every scroll they drift, resize and relocate, like stones lifting off a wall
//   3. they gather into a ring around the name
//   4. a vortex opens inside the ring, the ring spins up and the pieces are pulled in
//   5. the camera dives through the vortex; its dark core spreads to black and the 3D strip glides in
//
// Web-friendly by design: cards move with transforms / opacity, images are small (≈20 KB each), the
// vortex is ONE small WebGL canvas drawn at reduced resolution and only while it is visible, and the
// whole thing is removed from the page when it ends. Scrolling is native (touch momentum, keyboard,
// scrollbar) and smoothed with Lenis for wheels. Plays once per browser session; "Skip intro" ends it;
// visitors who prefer reduced motion never see it (see the small script in index.html's <head>).

const gsap = window.gsap;
const SEEN = "intro-seen";
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const smooth = (a, b, v) => {
  const t = clamp((v - a) / (b - a));
  return t * t * (3 - 2 * t);
};
const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2); // cubic in-out
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

// scroll timeline (0 → 1 over the intro's scroll length)
const T = { hold: 0.08, drift: 0.3, ring: 0.52, open: 0.64, pull: 0.86 };

export function startIntro({ profile, images, onDone }) {
  const html = document.documentElement;
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (!html.hasAttribute("data-intro") || reduced) {
    html.removeAttribute("data-intro");
    onDone();
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
    <div class="intro-hint" aria-hidden="true"><span>Scroll</span><i></i></div>
    <button class="intro-skip" type="button">Skip intro</button>`;
  document.body.append(scroller, stage);
  const cards = [...stage.querySelectorAll(".ic")];
  const text = stage.querySelector(".intro-text");
  const line = stage.querySelector(".it-line");
  const hint = stage.querySelector(".intro-hint");
  const cssVortex = stage.querySelector(".intro-vortex-css");
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

  /* --------------------------------------------------------------- frame */
  let p = 0; // smoothed progress
  let forced = null; // set while the ending plays by itself
  let raf = 0;
  let last = performance.now();
  let finishing = false;
  let done = false;

  const frame = (now) => {
    lenis?.raf(now); // Lenis only moves the scroller when it is ticked every frame
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    const time = now / 1000;
    const max = scroller.scrollHeight - scroller.clientHeight;
    const raw = forced ?? (max > 0 ? scroller.scrollTop / max : 0);
    p = forced != null ? raw : p + (raw - p) * (1 - Math.exp(-dt * 9));

    const drift = smooth(T.hold, T.drift, p);
    const toRing = smooth(T.drift - 0.02, T.ring, p);
    const pull = smooth(T.open, T.pull, p);
    const open = smooth(T.ring - 0.06, T.open, p);
    const dive = smooth(T.pull - 0.02, 1, p);

    // cards
    const spinHold = smooth(T.ring, T.open, p) * 0.12; // slow turn once the ring is formed (turns)
    const spinPull = Math.pow(pull, 1.6) * 1.15; // then it spins up while pulling in
    cards.forEach((el, i) => {
      const stagger = i * 0.012;
      const a = fromSB(SCATTER[i]);
      const b = fromSB(DRIFT[i]);
      const dI = ease(clamp((drift * (1 + 8 * 0.012) - stagger)));
      const rI = ease(clamp((toRing * (1 + 8 * 0.012) - stagger)));
      const th = ring.slot[i] + (spinHold + spinPull) * Math.PI * 2;
      const shrinkR = Math.pow(1 - pull, 1.3);
      const base = (ring.slot[i] * 180) / Math.PI; // tangent tilt at the card's place on the ring
      const upright = base - 180 * Math.round(base / 180); // folded into ±90°, so no card is upside down
      const c = { x: Math.sin(th) * ring.rx * shrinkR, y: -Math.cos(th) * ring.ry * shrinkR, w: ring.cw, h: ring.ch, r: upright + (spinHold + spinPull) * 360 };
      // scattered → drifted → ring
      let x = mix(a.x, b.x, dI);
      let y = mix(a.y, b.y, dI);
      let w = mix(a.w, b.w, dI);
      let h = mix(a.h, b.h, dI);
      let r = mix(a.r, b.r, dI);
      x = mix(x, c.x, rI);
      y = mix(y, c.y, rI);
      w = mix(w, c.w, rI);
      h = mix(h, c.h, rI);
      // turn the shorter way into the ring's tangent (same angle ± whole turns, nearest to the current tilt)
      r = mix(r, c.r - 360 * Math.round((c.r - r) / 360), rI);
      // weightless float while scattered (fades out as they lock into the ring)
      const fl = 1 - rI;
      x += Math.sin(time * 0.55 + i * 1.7) * 5 * k * fl;
      y += Math.cos(time * 0.47 + i * 2.3) * 6 * k * fl;
      r += Math.sin(time * 0.4 + i) * 1.4 * fl;
      const s = 1 - 0.82 * pull;
      const o = 1 - smooth(0.55, 1, pull);
      el.style.width = `${w}px`;
      el.style.height = `${h}px`;
      el.style.transform = `translate3d(${W / 2 + x - w / 2}px, ${H / 2 + y - h / 2}px, 0) rotate(${r}deg) scale(${s})`;
      el.style.opacity = String(o);
      el.style.setProperty("--glow", String(smooth(T.ring - 0.04, T.open, p) * (1 - pull)));
    });

    // text: name + roles from the start, the intro line joins as the pieces drift, all fade as the portal opens
    const textOut = 1 - smooth(T.ring + 0.02, T.open + 0.02, p);
    text.style.opacity = String(textOut);
    text.style.transform = `translate3d(-50%, -50%, 0) scale(${1 - 0.42 * toRing})`;
    line.style.opacity = String(smooth(T.hold, T.hold + 0.12, p));
    hint.style.opacity = String(1 - smooth(0.01, 0.06, p));

    // vortex: opens inside the ring, grows while pulling in, then fills the screen and fades to black
    const size = open * (1 + 0.35 * pull) + 7 * Math.pow(dive, 2.2);
    const bright = open * (1 - smooth(0.25, 0.95, dive));
    if (vortex) vortex.draw(time, size, bright, spinPull);
    else {
      cssVortex.style.opacity = String(bright);
      cssVortex.style.transform = `translate(-50%, -50%) scale(${0.2 + size}) rotate(${time * 40}deg)`;
    }

    if (!finishing && p > 0.93) finish(false);
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
      onDone(); // the 3D strip starts gliding in behind the black
      gsap.to(stage, {
        opacity: 0,
        duration: skip ? 0.5 : 0.8,
        ease: "power2.out",
        onComplete: () => {
          cancelAnimationFrame(raf);
          removeEventListener("resize", layout);
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
    gsap.to(s, { p: 1, duration: 1.2 * (1 - p) / 0.07 + 0.4, ease: "power1.in", onUpdate: () => (forced = s.p), onComplete: end });
  }
  stage.querySelector(".intro-skip").addEventListener("click", () => finish(true));
  addEventListener("keydown", function onEsc(e) {
    if (e.key !== "Escape" || done) return;
    removeEventListener("keydown", onEsc);
    finish(true);
  });
}

/* ------------------------------------------------------------------ vortex */
// A swirl drawn by one fragment shader on a small canvas (≈55% of the screen resolution: it is soft).
function createVortex(canvas) {
  const gl = canvas.getContext("webgl", { alpha: true, premultipliedAlpha: true, antialias: false, depth: false });
  if (!gl) return null;
  const vs = `attribute vec2 p; void main(){ gl_Position = vec4(p, 0.0, 1.0); }`;
  const fs = `precision mediump float;
uniform vec2 uRes; uniform float uTime, uSize, uBright, uSpin;
float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y); }
float fbm(vec2 p){ float v = 0.0, a = 0.5; for (int i = 0; i < 4; i++){ v += a * noise(p); p *= 2.03; a *= 0.5; } return v; }
void main(){
  vec2 uv = (gl_FragCoord.xy - 0.5 * uRes) / min(uRes.x, uRes.y);
  float R = 0.3 * max(uSize, 0.001);
  float rn = length(uv) / R;
  float a = atan(uv.y, uv.x);
  // spiral arms: the angle is twisted more toward the centre, and the whole thing turns
  float tw = a + 2.4 / (rn + 0.3) - uTime * 0.9 - uSpin * 6.0;
  float arms = fbm(vec2(cos(tw), sin(tw)) * 1.7 + vec2(log(rn + 0.02) * 2.2 - uTime * 0.5, 0.0));
  float streak = smoothstep(0.38, 0.82, arms);
  float body = smoothstep(1.05, 0.55, rn) * smoothstep(0.08, 0.5, rn);
  float core = smoothstep(0.55, 0.0, rn);
  vec3 deep = vec3(0.02, 0.07, 0.42), mid = vec3(0.22, 0.42, 1.0), hi = vec3(0.9, 0.95, 1.0);
  vec3 col = mix(deep, mid, streak) * body;
  col = mix(col, hi, smoothstep(0.45, 0.95, arms) * body * smoothstep(0.2, 0.8, rn));
  col = mix(col, deep * 0.6, core * 0.85);
  float halo = exp(-max(rn - 0.9, 0.0) * 3.5) * 0.45 * smoothstep(1.8, 0.95, rn);
  col += vec3(0.16, 0.3, 0.95) * halo;
  float alpha = clamp(max(body, core) + halo, 0.0, 1.0) * uBright;
  gl_FragColor = vec4(col * uBright, alpha);
}`;
  const sh = (type, src) => {
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    return gl.getShaderParameter(s, gl.COMPILE_STATUS) ? s : null;
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
  const uRes = u("uRes");
  const uTime = u("uTime");
  const uSize = u("uSize");
  const uBright = u("uBright");
  const uSpin = u("uSpin");
  const SCALE = 0.55;
  let cleared = true;
  return {
    resize(w, h) {
      canvas.width = Math.max(2, Math.round(w * SCALE));
      canvas.height = Math.max(2, Math.round(h * SCALE));
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.uniform2f(uRes, canvas.width, canvas.height);
    },
    draw(time, size, bright, spin) {
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
      gl.uniform1f(uTime, time);
      gl.uniform1f(uSize, size);
      gl.uniform1f(uBright, bright);
      gl.uniform1f(uSpin, spin);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    },
    dispose() {
      gl.getExtension("WEBGL_lose_context")?.loseContext();
    },
  };
}
