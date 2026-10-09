// First-load screen, built as a projector: a strip of film runs through a gate while the counter follows
// real loading progress (3D engine + project previews, core/loading.js). When everything is ready the film
// settles on a frame, collapses into a thin slit of light and the black shutters part — at that moment the
// 3D reel threads in behind them (playIntro). Ported from components/FilmLoader.tsx.
import { loading, requestReveal } from "../core/loading.js";

const gsap = window.gsap;
const MIN_MS = 1500; // never flash: the reel runs at least this long

export function startLoader(el) {
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const q = (s) => el.querySelector(s);
  const film = q(".fl-film");
  const count = q(".fl-count");
  const bar = q(".fl-bar i");

  const t0 = performance.now();
  let last = t0;
  let shown = 0;
  let x = 0;
  let raf = 0;
  let leaving = false;
  const frameW = () => film.offsetHeight * 1.6;

  const tick = (now) => {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    const cap = Math.min(1, (now - t0) / (reduced ? 300 : MIN_MS));
    const goal = Math.min(loading.ready ? 1 : loading.progress() * 0.97, cap);
    shown += (goal - shown) * (1 - Math.exp(-dt * 5));
    if (goal - shown < 0.004) shown = goal;
    count.textContent = String(Math.round(shown * 100)).padStart(3, "0");
    bar.style.transform = `scaleX(${shown})`;

    if (!leaving) {
      // the film runs fast while loading and eases off as it nears the end
      x += dt * frameW() * (1.2 + 5 * (1 - shown));
      film.style.transform = `translate3d(${-(x % frameW())}px,0,0)`;
      if (loading.ready && shown >= 1) leave();
    }
    raf = requestAnimationFrame(tick);
  };
  raf = requestAnimationFrame(tick);

  // never trap a visitor behind the shutters (e.g. WebGL failed to start)
  const safety = setTimeout(() => loading.markReady(), 9000);
  const finish = () => {
    cancelAnimationFrame(raf);
    clearTimeout(safety);
    el.remove();
  };

  function leave() {
    leaving = true;
    if (reduced) {
      el.dataset.open = "";
      requestReveal();
      gsap.timeline({ onComplete: finish }).to(el, { opacity: 0, duration: 0.4 });
      return;
    }
    const fw = frameW();
    const o = { x };
    const settle = Math.ceil(x / fw) * fw; // register a whole frame in the gate
    gsap
      .timeline({ onComplete: finish })
      .to(o, {
        x: settle + fw,
        duration: 0.7,
        ease: "power3.out",
        onUpdate: () => (film.style.transform = `translate3d(${-(o.x % fw) || 0}px,0,0)`),
      })
      .to(q(".fl-meta"), { opacity: 0, duration: 0.3 }, "<0.25")
      .to(q(".fl-gate"), { opacity: 0, duration: 0.3 }, "<")
      // the strip collapses into a slit of projector light…
      .to(q(".fl-strip"), { scaleY: 0, duration: 0.55, ease: "expo.in" }, ">-0.1")
      .fromTo(q(".fl-slit"), { opacity: 0, scaleX: 0.35 }, { opacity: 1, scaleX: 1, duration: 0.5, ease: "expo.out" }, ">-0.2")
      // …and the shutters open while the 3D reel threads in behind them
      .add(() => {
        el.dataset.open = ""; // brings the navigation back in
        requestReveal();
      }, ">-0.05")
      .to(q(".fl-top"), { yPercent: -100, duration: 1.25, ease: "expo.inOut" }, "<")
      .to(q(".fl-bottom"), { yPercent: 100, duration: 1.25, ease: "expo.inOut" }, "<")
      .to(q(".fl-slit"), { scaleY: 40, opacity: 0, duration: 0.9, ease: "power2.out" }, "<0.2");
  }
}
