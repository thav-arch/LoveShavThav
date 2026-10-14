// Elevator Empire: text that rises into place, counting numbers, the painted "Check it out!" button,
// and the gameplay videos (one plays at a time, each with its own sound control — js/video-manager.js).
// The page's HTML is projects/elevator-empire.html.
import { editorialScroll } from "../page-effects.js";
import { initVideos } from "../video-manager.js";

export function mount(cs) {
  const ee = cs.querySelector(".ee");
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const undoScroll = editorialScroll(cs);

  /* ------------------------------------------------ text reveal + counting numbers */
  const texts = [...ee.querySelectorAll(".ee-t[data-r]")];
  const counters = new WeakMap();
  const countUp = (el) => {
    const target = Number(el.dataset.count);
    const suffix = el.dataset.suffix || "";
    if (reduced) return;
    const t0 = performance.now() + 150;
    const dur = 1300;
    let raf = 0;
    const step = (now) => {
      const p = Math.min(1, Math.max(0, (now - t0) / dur));
      el.textContent = Math.round(target * (1 - Math.pow(1 - p, 3))) + suffix;
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    counters.set(el, () => cancelAnimationFrame(raf));
  };
  texts.forEach((el) => {
    if (el.dataset.count && !reduced) el.textContent = "0" + (el.dataset.suffix || ""); // counts up when seen
  });
  ee.classList.add("is-live");
  const io = new IntersectionObserver(
    (entries) => {
      entries
        .filter((e) => e.isIntersecting)
        .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top || a.boundingClientRect.left - b.boundingClientRect.left)
        .forEach((e, i) => {
          const el = e.target;
          el.style.setProperty("--d", Math.min(i * 0.07, 0.35).toFixed(2) + "s"); // neighbours rise one after another
          el.classList.add("in");
          if (el.dataset.count) countUp(el);
          io.unobserve(el);
        });
    },
    { root: cs, rootMargin: "0px 0px -8% 0px", threshold: 0.15 },
  );
  texts.forEach((el) => io.observe(el));

  /* ------------------------------------------------------- in-page links */
  // the page sets <base href="../">, so a bare "#id" would leave the page: scroll to it ourselves
  const onClick = (e) => {
    const a = e.target.closest("a[href*='#']");
    if (!a) return;
    const id = a.getAttribute("href").split("#")[1];
    const target = id && ee.querySelector("#" + CSS.escape(id));
    if (!target) return;
    e.preventDefault();
    const top = target.getBoundingClientRect().top - cs.getBoundingClientRect().top + cs.scrollTop - barH();
    if (cs.lenis && !reduced) cs.lenis.scrollTo(Math.max(0, top), { duration: 1.3, easing: (t) => 1 - Math.pow(1 - t, 4) });
    else cs.scrollTo({ top, behavior: reduced ? "auto" : "smooth" });
    setMenu(false);
  };
  cs.addEventListener("click", onClick);

  /* ------------------------------------------- section navigation (top bar) */
  const nav = cs.querySelector(".ee-nav");
  const navLinks = nav ? [...nav.querySelectorAll(".ee-nav-list a")] : [];
  const bar = nav?.querySelector(".ee-nav-bar");
  const toggle = nav?.querySelector(".ee-nav-toggle");
  const anchors = [...ee.querySelectorAll("[data-section]")];
  const barH = () => (cs.querySelector(".cs-bar")?.offsetHeight || 60) + 8;
  const setMenu = (open) => {
    if (!nav) return;
    nav.toggleAttribute("data-open", open);
    toggle?.setAttribute("aria-expanded", String(open));
  };
  toggle?.addEventListener("click", () => setMenu(!nav.hasAttribute("data-open")));
  // the section being read: the last one whose start has passed 40% of the screen
  let current = -1;
  let spyRaf = 0;
  // the yellow underline slides to the current link (desktop bar only)
  const moveBar = () => {
    const l = navLinks[current];
    if (!bar || !l || !l.offsetParent) return;
    bar.style.width = l.offsetWidth + "px";
    bar.style.transform = "translateX(" + l.offsetLeft + "px)";
  };
  const spy = () => {
    spyRaf = 0;
    const line = cs.getBoundingClientRect().top + cs.clientHeight * 0.4;
    let idx = 0;
    anchors.forEach((a, i) => {
      if (a.getBoundingClientRect().top <= line) idx = i;
    });
    if (idx === current) return;
    current = idx;
    navLinks.forEach((l, i) => (i === idx ? l.setAttribute("aria-current", "true") : l.removeAttribute("aria-current")));
    if (toggle) toggle.textContent = navLinks[idx]?.textContent || "Sections";
    moveBar();
  };
  const onSpy = () => {
    if (!spyRaf) spyRaf = requestAnimationFrame(spy);
  };
  cs.addEventListener("scroll", onSpy, { passive: true });
  addEventListener("resize", moveBar);
  spy();
  const late = setTimeout(() => ((current = -1), spy()), 300); // once the fonts have set the link widths

  /* ---------------------------------------------------------------- videos */
  const undoVideos = initVideos(cs);

  return () => {
    io.disconnect();
    texts.forEach((el) => counters.get(el)?.());
    cs.removeEventListener("click", onClick);
    cs.removeEventListener("scroll", onSpy);
    removeEventListener("resize", moveBar);
    cancelAnimationFrame(spyRaf);
    clearTimeout(late);
    undoVideos();
    undoScroll();
  };
}

// opened on its own (not loaded by the 3D home page)
if (document.body.hasAttribute("data-standalone")) {
  mount(document.querySelector(".cs"));
}
