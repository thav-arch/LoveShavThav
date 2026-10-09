// FULL view: the strip drops away and the projects become a typographic index. Hovering a title floats a
// tilted preview card that trails the pointer; clicking expands that card into the case study.
// Ported from components/ProjectIndex.tsx.
import { clamp, damp } from "../core/motion.js";
import { projects } from "../core/projects.js";
import * as store from "../core/store.js";
import { enterProject } from "./transitions.js";

const gsap = window.gsap;
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

export function initIndex() {
  const root = document.querySelector(".index");
  const list = root.querySelector(".idx-list");
  const caption = root.querySelector(".idx-caption");
  const preview = root.querySelector(".idx-preview");

  list.innerHTML = projects
    .map(
      (p, i) =>
        `<button class="idx-item" tabindex="-1"><span class="idx-mask"><span class="idx-rise"><sup>${String(i + 1).padStart(2, "0")}</sup>${esc(p.title)}</span></span></button>` +
        (i < projects.length - 1 ? `<span class="idx-dot" aria-hidden="true"><span class="idx-mask"><span class="idx-rise">·</span></span></span>` : ""),
    )
    .join("");
  preview.innerHTML = projects
    .map((p) => {
      const src = p.thumbnailSmall || p.thumbnail;
      return src ? `<img src="${src}" alt="" loading="lazy">` : `<img alt="" hidden>`;
    })
    .join("");
  const imgs = [...preview.querySelectorAll("img")];
  const items = [...list.querySelectorAll(".idx-item")];
  const defaultCaption = `${projects.length} projects`;
  caption.textContent = defaultCaption;

  let hover = null;
  const setHover = (i) => {
    hover = i;
    list.toggleAttribute("data-hovering", i !== null);
    items.forEach((el, n) => el.toggleAttribute("data-active", n === i));
    imgs.forEach((el, n) => el.toggleAttribute("data-on", n === i));
    caption.textContent = i !== null ? `${projects[i].subtitle} — ${projects[i].year}` : defaultCaption;
  };
  items.forEach((el, i) => {
    el.addEventListener("pointerenter", (e) => e.pointerType === "mouse" && setHover(i));
    el.addEventListener("pointerleave", () => setHover(null));
    el.addEventListener("focus", () => setHover(i));
    el.addEventListener("blur", () => setHover(null));
    el.addEventListener("click", () => {
      const usePreview = hover === i && Number(preview.style.opacity) > 0.5;
      enterProject(projects[i].slug, "index", usePreview ? preview : el);
    });
  });

  // staggered rise of the titles, and the preview card's pointer-following loop — only while the view is open
  let tween = null;
  let raf = 0;
  let onMove = null;
  const open = () => {
    const words = list.querySelectorAll(".idx-rise");
    // y: 0 on both ends — GSAP would otherwise absorb the CSS translateY(115%) into y
    tween = gsap.fromTo(words, { y: 0, yPercent: 115, rotate: 3 }, { y: 0, yPercent: 0, rotate: 0, duration: 1.1, ease: "expo.out", stagger: 0.06, delay: 0.35 });

    let x = innerWidth / 2;
    let y = innerHeight / 2;
    let tx = x;
    let ty = y;
    let s = 0;
    let rot = 0;
    let last = performance.now();
    onMove = (e) => {
      tx = e.clientX;
      ty = e.clientY;
    };
    const tick = (now) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const px = x;
      x = damp(x, tx, 9, dt);
      y = damp(y, ty, 9, dt);
      rot = damp(rot, clamp(((x - px) / Math.max(dt, 0.001)) * 0.012, -14, 14), 6, dt);
      s = damp(s, hover === null ? 0 : 1, 10, dt);
      preview.style.transform = `translate3d(${x}px, ${y}px, 0) translate(-50%, -50%) perspective(800px) rotateY(${rot * 1.4}deg) rotateZ(${rot * 0.5}deg) scale(${0.6 + 0.4 * s})`;
      preview.style.opacity = String(s);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    addEventListener("pointermove", onMove);
  };
  const close = () => {
    tween?.kill();
    cancelAnimationFrame(raf);
    if (onMove) removeEventListener("pointermove", onMove);
    onMove = null;
    preview.style.opacity = "0";
    setHover(null);
  };
  let on = false;
  store.subscribe((s) => {
    const now = s.mode === "INDEX";
    if (now === on) return;
    on = now;
    now ? open() : close();
  });
}
