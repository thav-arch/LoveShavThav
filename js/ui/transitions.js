// Transition orchestration, ported from lib/transitions.ts. Every state change goes through here, so the
// WebGL scene (via `motion`) and the page (via the store and the #project-transition overlay) move together.
// The Next.js router is replaced by a tiny history helper (see project-page.js).
import { centreInstance, INSTANCE_COUNT, mod, motion, positionFor } from "../core/motion.js";
import { projectIndex, projects } from "../core/projects.js";
import * as store from "../core/store.js";
import { isPortalMode } from "../core/store.js";
import { HOME_URL, loadProjectPage, mountProjectPage, unmountProjectPage } from "./project-page.js";

const gsap = window.gsap;
const S = () => store.state;
const overlay = () => document.getElementById("project-transition");
const parts = (el) => ({ white: el.querySelector(".pt-white"), media: el.querySelector(".pt-media") });
const FULL = "inset(0px 0px 0px 0px round 0px)";

function resetOverlay() {
  const el = overlay();
  if (!el) return;
  const { white, media } = parts(el);
  gsap.set(el, { autoAlpha: 0, clipPath: FULL });
  gsap.set(white, { opacity: 0 });
  gsap.set(media, { opacity: 0 });
}

/** resolves once `test` passes (polled per frame), or after `timeout` ms */
const waitFor = (test, timeout = 4000) =>
  new Promise((resolve) => {
    const t0 = performance.now();
    const tick = () => (test() || performance.now() - t0 > timeout ? resolve() : requestAnimationFrame(tick));
    tick();
  });

/* ------------------------------------------------------------------ intro */

let introStarted = false;

export function playIntro(skip = false) {
  if (introStarted) return;
  introStarted = true;
  if (skip || motion.reducedMotion) {
    motion.intro = 1;
    store.set({ introDone: true });
    return;
  }
  // the reel threads in from the right and glides to a stop on frame 01
  motion.pos = -4.5;
  motion.target = 0;
  motion.dampOverride = 1.1;
  gsap.to(motion, {
    intro: 1,
    duration: 3.2,
    ease: "power2.out",
    onComplete: () => store.set({ introDone: true }),
  });
  gsap.delayedCall(2.8, () => (motion.dampOverride = 0));
}

/* ----------------------------------------------------- world-level modes */

/** FEATURED (WORLD), FULL (INDEX) and PROFILE (the chrome portal) */
export function setMode(mode) {
  const s = S();
  if (s.transition !== "idle" || s.mode === "PROJECT" || s.mode === mode) return;
  store.set({ mode });
  const portal = isPortalMode(mode) ? 1 : 0;
  gsap.to(motion.portal, {
    open: portal,
    duration: portal ? 1.9 : 1.1,
    ease: portal ? "power2.out" : "power3.inOut",
    overwrite: true,
  });
  const vis = mode === "INDEX" ? 0 : 1;
  if (motion.worldVis !== vis)
    gsap.to(motion, {
      worldVis: vis,
      duration: vis ? 1.4 : 0.9,
      ease: vis ? "power3.out" : "power3.in",
      overwrite: "auto",
    });
}

export const togglePortal = (mode) => setMode(S().mode === mode ? "WORLD" : mode);

/* ------------------------------------------------------- open a project */

let soonTimer = 0;
/** a project that has no case-study page yet: a quiet note instead of an animation */
function showSoon(title) {
  const el = document.getElementById("soon");
  if (!el) return;
  el.textContent = `${title} — case study coming soon`;
  el.dataset.on = "";
  clearTimeout(soonTimer);
  soonTimer = setTimeout(() => delete el.dataset.on, 2600);
}

/**
 * World: the centred card flies to the camera, unrolls flat, brightens, then
 * the screen washes to white and the case study mounts underneath.
 * Index: the floating preview card expands (clip-path) to full screen.
 */
export function enterProject(slug, origin, fromEl) {
  const s = S();
  const index = projectIndex(slug);
  const el = overlay();
  if (s.transition !== "idle" || index < 0 || !el) return;
  const project = projects[index];
  if (!project.page) return showSoon(project.title);
  const { white, media } = parts(el);
  store.set({ transition: "entering", selectedSlug: slug, openedFrom: origin, activeIndex: index, direction: 1 });

  // fetch the page while the animation plays
  const page = loadProjectPage(project);

  const tl = gsap.timeline({
    onComplete: async () => {
      try {
        await page;
        const content = mountProjectPage(project);
        store.set({ mode: "PROJECT" });
        // (Forward re-opens an entry that already carries this project, so only push for a fresh open)
        if (history.state?.project !== slug) history.pushState({ project: slug }, "", new URL(project.page, HOME_URL).href);
        revealProject(content);
      } catch (e) {
        console.error("Could not open the project page", e);
        // never leave the visitor stuck behind the white wash
        resetOverlay();
        motion.flyInstance = -1;
        motion.fly = 0;
        store.set({ transition: "idle", mode: "WORLD", selectedSlug: null });
      }
    },
  });

  if (origin === "world") {
    motion.target = positionFor(index, motion.pos);
    motion.flyInstance = mod(motion.target, INSTANCE_COUNT);
    gsap.set(el, { autoAlpha: 1, clipPath: FULL });
    gsap.set(white, { opacity: 0 });
    gsap.set(media, { opacity: 0 });
    tl.to(motion, { fly: 1, duration: motion.reducedMotion ? 0.4 : 1.25, ease: "expo.inOut" }, 0).to(white, { opacity: 1, duration: 0.4, ease: "power1.in" }, motion.reducedMotion ? 0.2 : 0.95);
  } else {
    // keep the 3D world in sync so closing returns to this project
    motion.pos = motion.target = positionFor(index, motion.pos);
    const r = fromEl?.getBoundingClientRect() ?? new DOMRect(innerWidth * 0.35, innerHeight * 0.35, innerWidth * 0.3, innerHeight * 0.3);
    if (project.thumbnail) media.src = project.thumbnail;
    gsap.set(el, {
      autoAlpha: 1,
      clipPath: `inset(${r.top}px ${innerWidth - r.right}px ${innerHeight - r.bottom}px ${r.left}px round 10px)`,
    });
    gsap.set(media, { opacity: project.thumbnail ? 1 : 0, scale: 1.15 });
    gsap.set(white, { opacity: 0 });
    tl.to(el, { clipPath: FULL, duration: 1.05, ease: "expo.inOut" }, 0)
      .to(media, { scale: 1, duration: 1.05, ease: "expo.inOut" }, 0)
      .to(white, { opacity: 1, duration: 0.4, ease: "power1.in" }, 0.8);
  }
}

/** called once the case study is in the page — removes the white wash */
export function revealProject(content) {
  motion.paused = true;
  if (S().mode !== "PROJECT") store.set({ mode: "PROJECT" });
  const intro = content ? content.querySelectorAll("[data-intro]") : [];
  const el = overlay();
  if (el && Number(gsap.getProperty(el, "opacity")) > 0) {
    gsap.to(el, { autoAlpha: 0, duration: 0.7, delay: 0.05, ease: "power2.out", overwrite: true, onComplete: resetOverlay });
  }
  if (intro.length) gsap.fromTo(intro, { y: 60, opacity: 0 }, { y: 0, opacity: 1, duration: 1.2, ease: "expo.out", stagger: 0.06, delay: 0.15, overwrite: true });
  gsap.delayedCall(0.3, () => store.set({ transition: "idle" }));
}

/* ------------------------------------------------------ close a project */

/**
 * White wash covers the case study, the page goes back to the world, then the
 * card shrinks from full screen back into its slot on the arc while the white
 * overlay contracts and fades. The same project stays centred.
 * `push` is false when the browser's Back button already changed the address.
 */
export function exitProject(push = true) {
  const s = S();
  const el = overlay();
  if (s.transition !== "idle" || !el) return;
  const index = s.activeIndex;
  const { white, media } = parts(el);
  store.set({ transition: "exiting" });

  gsap.set(el, { clipPath: FULL });
  gsap.set(white, { opacity: 1 });
  gsap.set(media, { opacity: 0 });

  const tl = gsap.timeline();
  tl.fromTo(el, { autoAlpha: push ? 0 : 1 }, { autoAlpha: 1, duration: push ? 0.45 : 0.01, ease: "power2.inOut" })
    .add(() => {
      motion.pos = motion.target = positionFor(index, motion.pos);
      motion.vel = 0;
      motion.flyInstance = centreInstance();
      motion.fly = 1;
      motion.worldVis = 1;
      motion.portal.open = 0;
      motion.intro = 1;
      motion.paused = false;
      store.set({ mode: "WORLD", selectedSlug: null });
      if (push) history.pushState(null, "", HOME_URL);
      tl.pause();
      unmountProjectPage();
      waitFor(() => !document.querySelector("[data-case-study]")).then(() => tl.play());
    })
    .addLabel("back", "+=0.08")
    .to(motion, { fly: 0, duration: motion.reducedMotion ? 0.4 : 1.35, ease: "expo.out" }, "back")
    .to(el, { clipPath: "inset(24% 28% 30% 28% round 28px)", duration: 0.9, ease: "expo.out" }, "back")
    .to(el, { autoAlpha: 0, duration: 0.55, ease: "power2.out" }, "back+=0.1")
    .add(() => {
      motion.flyInstance = -1;
      resetOverlay();
      store.set({ transition: "idle" });
    });
}
