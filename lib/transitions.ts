import gsap from "gsap";
import { projects, projectIndex } from "@/lib/projects";
import { centreInstance, INSTANCE_COUNT, mod, motion, positionFor, PROJECT_COUNT } from "./motion";
import { isPortalMode, usePortfolio, type PortfolioMode } from "./store";

/**
 * Transition orchestration. Every state change in the site goes through
 * here, so the WebGL scene (via `motion`) and the DOM (via the store and the
 * #project-transition overlay) always move together.
 */
type Router = { push: (href: string, options?: { scroll?: boolean }) => void };

const S = () => usePortfolio.getState();
const overlay = () => document.getElementById("project-transition");
const parts = (el: HTMLElement) => ({
  white: el.querySelector<HTMLElement>(".pt-white")!,
  media: el.querySelector<HTMLImageElement>(".pt-media")!,
});
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
function waitFor(test: () => boolean, timeout = 4000) {
  return new Promise<void>((resolve) => {
    const t0 = performance.now();
    const tick = () => (test() || performance.now() - t0 > timeout ? resolve() : requestAnimationFrame(tick));
    tick();
  });
}

/* ------------------------------------------------------------------ intro */

let introStarted = false;

export function playIntro(skip = false) {
  if (introStarted) return;
  introStarted = true;
  if (skip || motion.reducedMotion) {
    motion.intro = 1;
    S().set({ introDone: true });
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
    onComplete: () => S().set({ introDone: true }),
  });
  gsap.delayedCall(2.8, () => (motion.dampOverride = 0));
}

/* ----------------------------------------------------- world-level modes */

/** FEATURED (WORLD), FULL (INDEX), PROFILE and PLAYGROUND (portal) */
export function setMode(mode: Exclude<PortfolioMode, "PROJECT" | "PAGE">) {
  const s = S();
  if (s.transition !== "idle" || s.mode === "PROJECT" || s.mode === "PAGE" || s.mode === mode) return;
  s.set({ mode });
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

export const togglePortal = (mode: "PROFILE" | "PLAYGROUND") => setMode(S().mode === mode ? "WORLD" : mode);

/* ------------------------------------------------------- open a project */

/**
 * World: the centred card flies to the camera, unrolls flat, brightens, then
 * the screen washes to white and the case study mounts underneath.
 * Index: the floating preview card expands (clip-path) to full screen.
 */
export function enterProject(slug: string, router: Router, origin: "world" | "index", fromEl?: HTMLElement | null) {
  const s = S();
  const index = projectIndex(slug);
  const el = overlay();
  if (s.transition !== "idle" || index < 0 || !el) return;
  const { white, media } = parts(el);
  s.set({ transition: "entering", selectedSlug: slug, openedFrom: origin, activeIndex: index, direction: 1 });

  const tl = gsap.timeline({
    onComplete: () => {
      s.set({ mode: "PROJECT" });
      router.push(`/projects/${slug}`, { scroll: false });
    },
  });

  if (origin === "world") {
    motion.target = positionFor(index, motion.pos);
    motion.flyInstance = mod(motion.target, INSTANCE_COUNT);
    gsap.set(el, { autoAlpha: 1, clipPath: FULL });
    gsap.set(white, { opacity: 0 });
    gsap.set(media, { opacity: 0 });
    tl.to(motion, { fly: 1, duration: motion.reducedMotion ? 0.4 : 1.25, ease: "expo.inOut" }, 0).to(
      white,
      { opacity: 1, duration: 0.4, ease: "power1.in" },
      motion.reducedMotion ? 0.2 : 0.95,
    );
  } else {
    // keep the 3D world in sync so closing returns to this project
    motion.pos = motion.target = positionFor(index, motion.pos);
    const r = fromEl?.getBoundingClientRect() ?? new DOMRect(innerWidth * 0.35, innerHeight * 0.35, innerWidth * 0.3, innerHeight * 0.3);
    media.src = projects[index].thumbnail;
    gsap.set(el, {
      autoAlpha: 1,
      clipPath: `inset(${r.top}px ${innerWidth - r.right}px ${innerHeight - r.bottom}px ${r.left}px round 10px)`,
    });
    gsap.set(media, { opacity: 1, scale: 1.15 });
    gsap.set(white, { opacity: 0 });
    tl.to(el, { clipPath: FULL, duration: 1.05, ease: "expo.inOut" }, 0)
      .to(media, { scale: 1, duration: 1.05, ease: "expo.inOut" }, 0)
      .to(white, { opacity: 1, duration: 0.4, ease: "power1.in" }, 0.8);
  }
}

/** called by the case study once it has mounted — removes the white wash */
export function revealProject(content: HTMLElement | null) {
  const s = S();
  motion.paused = true;
  if (s.mode !== "PROJECT") s.set({ mode: "PROJECT" });
  // explicit fromTo values: safe if the mount effect runs twice (React strict mode)
  const intro = content ? content.querySelectorAll("[data-intro]") : [];
  const rise = (y: number, delay: number) =>
    gsap.fromTo(intro, { y, opacity: 0 }, { y: 0, opacity: 1, duration: 1.2, ease: "expo.out", stagger: 0.06, delay, overwrite: true });

  if (s.transition === "switching" && content) {
    gsap.fromTo(
      content,
      { x: s.direction * 90, opacity: 0 },
      {
        x: 0,
        opacity: 1,
        duration: 0.9,
        ease: "expo.out",
        overwrite: true,
        onComplete: () => S().set({ transition: "idle" }),
      },
    );
    rise(50, 0);
    return;
  }

  const el = overlay();
  if (el && Number(gsap.getProperty(el, "opacity")) > 0) {
    gsap.to(el, { autoAlpha: 0, duration: 0.7, delay: 0.05, ease: "power2.out", overwrite: true, onComplete: resetOverlay });
  }
  rise(60, 0.15);
  gsap.delayedCall(0.3, () => S().set({ transition: "idle" }));
}

/* ------------------------------------------------------ close a project */

/**
 * White wash covers the case study, the route changes back to the world,
 * then the card shrinks from full screen back into its slot on the arc while
 * the white overlay contracts and fades. The same project stays centred.
 */
export function exitProject(router: Router | null) {
  const s = S();
  const el = overlay();
  if (s.transition !== "idle" || !el) return;
  const index = s.activeIndex;
  const { white, media } = parts(el);
  s.set({ transition: "exiting" });

  gsap.set(el, { clipPath: FULL });
  gsap.set(white, { opacity: 1 });
  gsap.set(media, { opacity: 0 });

  const tl = gsap.timeline();
  tl.fromTo(el, { autoAlpha: router ? 0 : 1 }, { autoAlpha: 1, duration: router ? 0.45 : 0.01, ease: "power2.inOut" })
    .add(() => {
      motion.pos = motion.target = positionFor(index, motion.pos);
      motion.vel = 0;
      motion.flyInstance = centreInstance();
      motion.fly = 1;
      motion.worldVis = 1;
      motion.portal.open = 0;
      motion.intro = 1;
      motion.paused = false;
      s.set({ mode: "WORLD", selectedSlug: null });
      router?.push("/", { scroll: false });
      tl.pause();
      waitFor(() => !document.querySelector("[data-case-study]")).then(() => tl.play());
    })
    .addLabel("back", "+=0.08")
    .to(motion, { fly: 0, duration: motion.reducedMotion ? 0.4 : 1.35, ease: "expo.out" }, "back")
    .to(el, { clipPath: "inset(24% 28% 30% 28% round 28px)", duration: 0.9, ease: "expo.out" }, "back")
    .to(el, { autoAlpha: 0, duration: 0.55, ease: "power2.out" }, "back+=0.1")
    .add(() => {
      motion.flyInstance = -1;
      resetOverlay();
      S().set({ transition: "idle" });
    });
}

/* ------------------------------------------------------ previous / next */

export function switchProject(dir: 1 | -1, router: Router) {
  const s = S();
  if (s.transition !== "idle") return;
  const next = mod(s.activeIndex + dir, PROJECT_COUNT);
  const slug = projects[next].slug;
  const content = document.querySelector<HTMLElement>("[data-cs-content]");
  s.set({ transition: "switching", direction: dir });
  gsap.to(content, {
    x: -dir * 90,
    opacity: 0,
    duration: 0.45,
    ease: "power3.in",
    onComplete: () => {
      motion.pos = motion.target = positionFor(next, motion.pos);
      s.set({ activeIndex: next, selectedSlug: slug });
      router.push(`/projects/${slug}`, { scroll: false });
    },
  });
}
