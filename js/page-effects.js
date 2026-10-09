// Shared behaviour of the long editorial pages (case studies): smooth scrolling inside the page's own
// scroll box (Lenis), subtle image parallax, edge drift, reveal-on-enter, close buttons.
// Ported from components/useEditorialScroll.ts. Returns a function that undoes everything.
export function editorialScroll(cs) {
  const content = cs.querySelector("[data-cs-content]");
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  cs.focus({ preventScroll: true });

  let lenis = null;
  let raf = 0;
  if (window.Lenis && !reduced) {
    lenis = new window.Lenis({ wrapper: cs, content, lerp: 0.11, smoothWheel: true });
    const loop = (t) => {
      lenis.raf(t);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
  }

  const layers = [...cs.querySelectorAll("[data-parallax]")];
  const drift = [...cs.querySelectorAll("[data-drift]")];
  const parallax = () => {
    const vh = innerHeight;
    for (const el of layers) {
      const r = el.parentElement.getBoundingClientRect();
      if (r.bottom < -100 || r.top > vh + 100) continue;
      const p = (r.top + r.height / 2 - vh / 2) / vh;
      el.style.transform = `translate3d(0, ${(p * -7).toFixed(2)}%, 0)`;
    }
    if (reduced) return;
    for (const el of drift) {
      const r = el.getBoundingClientRect();
      if (r.bottom < -200 || r.top > vh + 200) continue;
      el.style.setProperty("--drift", `${(((r.top + r.height / 2) / vh - 0.5) * -48).toFixed(1)}px`);
    }
  };
  cs.addEventListener("scroll", parallax, { passive: true });
  parallax();
  const late = setTimeout(parallax, 400);

  const io = new IntersectionObserver(
    (entries) =>
      entries.forEach((e) => {
        if (e.isIntersecting) e.target.classList.add("in");
        const v = e.target.querySelector("video[data-autoplay]");
        if (v) e.isIntersecting ? v.play().catch(() => {}) : v.pause();
      }),
    { root: cs, threshold: 0.12 },
  );
  cs.querySelectorAll("[data-reveal]").forEach((el) => io.observe(el));

  // Close buttons: when the 3D home page loaded this page it listens for "project:close";
  // opened on its own, they simply go back to the home page.
  const onClick = (e) => {
    if (!e.target.closest("[data-action=close]")) return;
    if (document.body.hasAttribute("data-standalone")) location.href = "index.html";
    else document.dispatchEvent(new CustomEvent("project:close"));
  };
  cs.addEventListener("click", onClick);

  return () => {
    clearTimeout(late);
    cancelAnimationFrame(raf);
    lenis?.destroy();
    io.disconnect();
    cs.removeEventListener("scroll", parallax);
    cs.removeEventListener("click", onClick);
  };
}
