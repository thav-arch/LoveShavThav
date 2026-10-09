"use client";

import Lenis from "lenis";
import { useEffect, type RefObject } from "react";

/**
 * Smooth editorial scrolling for the light pages (case studies, journal,
 * about): Lenis inside the page's own scroll container, subtle image
 * parallax, reveal-on-enter, and videos that only play while visible.
 * Native wheel / trackpad / touch / keyboard / scrollbar all still work.
 */
export function useEditorialScroll(wrapper: RefObject<HTMLElement | null>, content: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const root = wrapper.current;
    const inner = content.current;
    if (!root || !inner) return;
    root.focus({ preventScroll: true });

    const lenis = new Lenis({ wrapper: root, content: inner, lerp: 0.11, smoothWheel: true });
    let raf = 0;
    const loop = (t: number) => {
      lenis.raf(t);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    const layers = Array.from(root.querySelectorAll<HTMLElement>("[data-parallax]"));
    // scroll-linked blocks (drawn paths, connectors, footprints): --p = 0 → 1 as the
    // element travels from the bottom of the screen to a little above its middle
    const progress = Array.from(root.querySelectorAll<HTMLElement>("[data-progress]"));
    // edge ornaments drift slightly against the scroll
    const drift = Array.from(root.querySelectorAll<HTMLElement>("[data-drift]"));
    const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) progress.forEach((el) => el.style.setProperty("--p", "1"));
    const parallax = () => {
      const vh = innerHeight;
      for (const el of layers) {
        const r = el.parentElement!.getBoundingClientRect();
        if (r.bottom < -100 || r.top > vh + 100) continue;
        const p = (r.top + r.height / 2 - vh / 2) / vh;
        el.style.transform = `translate3d(0, ${(p * -7).toFixed(2)}%, 0)`;
      }
      if (reduced) return;
      for (const el of progress) {
        const r = el.getBoundingClientRect();
        if (r.bottom < -vh || r.top > vh * 2) continue;
        const p = Math.min(1, Math.max(0, (vh - r.top) / (r.height + vh * 0.35)));
        el.style.setProperty("--p", p.toFixed(3));
      }
      for (const el of drift) {
        const r = el.getBoundingClientRect();
        if (r.bottom < -200 || r.top > vh + 200) continue;
        el.style.setProperty("--drift", `${(((r.top + r.height / 2) / vh - 0.5) * -48).toFixed(1)}px`);
      }
    };
    lenis.on("scroll", parallax);
    parallax();
    // blocks that measure themselves (path, board) mount their SVG a moment later
    const late = setTimeout(parallax, 400);

    const io = new IntersectionObserver(
      (entries) =>
        entries.forEach((e) => {
          if (e.isIntersecting) e.target.classList.add("in");
          const v = e.target.querySelector<HTMLVideoElement>("video[data-autoplay]");
          if (v) e.isIntersecting ? v.play().catch(() => {}) : v.pause();
        }),
      { root, threshold: 0.12 },
    );
    root.querySelectorAll("[data-reveal]").forEach((el) => io.observe(el));

    return () => {
      clearTimeout(late);
      cancelAnimationFrame(raf);
      lenis.destroy();
      io.disconnect();
    };
  }, [wrapper, content]);
}
