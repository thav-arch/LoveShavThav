// Entry point of the landing page: wires the content (js/data.js), the 3D world, the
// navigation, the Full view, the Profile portal and the project pages together.
import { onCursorLabel } from "./core/cursor.js";
import { loading, onReveal, requestReveal } from "./core/loading.js";
import { motion } from "./core/motion.js";
import { projectIndex, setProjects } from "./core/projects.js";
import * as store from "./core/store.js";
import { createWorld } from "./world/scene.js";
import { initIndex } from "./ui/index-view.js";
import { initFocusDesc } from "./ui/focus-desc.js";
import { startIntro } from "./ui/intro.js?v=20261014f"; // version-tagged: changes often
import { initNav } from "./ui/nav.js";
import { enterProject, exitProject, playIntro, setMode, switchProject } from "./ui/transitions.js";

// js/data.js is fetched fresh on every visit (the ?v= stamp skips the browser cache), so after you publish an
// edited project list visitors see it straight away instead of an old saved copy for up to 10 minutes
await import(`./data.js?v=${Date.now()}`);
const { projects, profile, intro: introText = {} } = window.SITE;

// The look of the 3D world — tune it here (values were set in the old dashboard's theme settings).
Object.assign(motion.theme, {
  gridHue: 0, // 0–1: rotates the glowing grid's colour
  gridIntensity: 0, // the moving floor grid caused motion sickness: off (0). 0.55 brings it back
  cursorWake: true, // the liquid ripple that follows the cursor
  wakeStrength: 0.006,
  cardRadius: 0.045, // rounded corners of the film frames
});

// paths in js/data.js are relative to the site root; make them absolute now, while the address bar is still the
// home page (it changes to projects/<name>.html while a project is open)
const abs = (u) => (u ? new URL(u, document.baseURI).href : u);
setProjects(projects.map((p) => ({ ...p, id: p.slug, thumbnail: abs(p.thumbnail), thumbnailSmall: abs(p.thumbnailSmall), page: abs(p.page) })));

/* ----------------------------------------------------------- profile portal */
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const portal = document.querySelector(".portal-content");
portal.querySelector(".pf-name").textContent = profile.name;
portal.querySelector(".pf-roles").innerHTML = profile.roles.map((r) => `<span>${esc(r)}</span>`).join("");
portal.querySelector(".pf-intro").textContent = profile.intro;
portal.querySelector(".pf-edu").innerHTML = profile.education.map((l) => `<span>${esc(l)}</span>`).join("");
portal.querySelector(".pf-skills").innerHTML = profile.skills.map((s) => `<li>${esc(s)}</li>`).join("");
portal.querySelector(".pf-links").innerHTML =
  (profile.email ? `<a href="mailto:${esc(profile.email)}" tabindex="-1">Email</a>` : "") +
  profile.links.map((l) => `<a href="${esc(l.url)}" target="_blank" rel="noopener noreferrer" tabindex="-1">${esc(l.label)}</a>`).join("");

/* --------------------------------------------------------------- the world */
let world = null;
try {
  world = createWorld(document.querySelector(".scene"), { openProject: (slug, origin) => enterProject(slug, origin) });
} catch (e) {
  // no WebGL: the page falls back to the Full (list) view
  console.error("The 3D world could not start:", e);
  import("./core/loading.js").then(({ loading }) => loading.markReady());
  onReveal(() => {
    playIntro(true);
    setMode("INDEX");
  });
}
onReveal(() => playIntro());

initNav();
initIndex();

// cursor: grab over the world, pointer over a card, grabbing while dragging (core/cursor.js labels)
onCursorLabel((label) => {
  const root = document.documentElement;
  if (label === "DRAG") root.dataset.sceneCursor = "grabbing";
  else if (label) root.dataset.sceneCursor = "pointer";
  else delete root.dataset.sceneCursor;
});

// The scroll intro (js/ui/intro.js) plays first; the 3D strip waits behind it, paused (no GPU work), and
// glides in once the intro has ended AND the project previews are decoded (the scene also marks itself
// ready after a few seconds, so a slow image never holds it back).
let introDone = false;
let revealed = false;
const tryReveal = () => {
  if (revealed || !introDone || !loading.ready) return;
  revealed = true;
  motion.paused = false;
  requestReveal();
};
loading.subscribe(tryReveal);
if (document.documentElement.hasAttribute("data-intro")) motion.paused = true;
startIntro({
  profile,
  lines: introText.lines || [],
  // the pieces of work that gather into the portal: project covers + a few shots from the case studies
  images: (() => {
    const c = Object.fromEntries(projects.filter((p) => p.thumbnailSmall).map((p) => [p.slug, p.thumbnailSmall]));
    return [c["songs-of-saaja"], c["dabba-rush"], c["umbrella-man"], "images/intro/elevator-lobby.webp", c["farmville-2-event-design"], "images/intro/saaja-environment.webp", c["elevator-empire"], "images/intro/saaja-keyart.webp"].filter(Boolean);
  })(),
  onDone: ({ skipped } = {}) => {
    const go = () => {
      introDone = true;
      tryReveal();
    };
    if (skipped || !introText.welcome) go();
    else showWelcome(introText.welcome, go);
  },
});

/* ------------------------------------------------------------- navigation */
// Closing a project steps back in history (so the Back button and Close behave the same);
// if the project was never pushed there is nothing to step back to, so it just closes.
const closeProject = () => {
  // step back past every project page visited with Previous / Next, straight to the 3D world
  if (history.state?.project) history.go(-(history.state.depth || 1));
  else exitProject(true);
};
// Escape steps back toward the world
addEventListener("keydown", (e) => {
  if (e.key !== "Escape") return;
  const s = store.state;
  if (s.mode === "PROJECT") closeProject();
  else if (s.mode !== "WORLD") setMode("WORLD");
});
// the Close button on a case study
document.addEventListener("project:close", closeProject);
// Previous / Next at the end of a case study (js/adjacent.js)
document.addEventListener("project:switch", (e) => switchProject(e.detail.slug, e.detail.dir));
// Back / Forward: close the open project, re-open the one the history entry belongs to, or slide between projects
addEventListener("popstate", () => {
  const s = store.state;
  if (s.transition !== "idle") return;
  const slug = history.state?.project;
  if (s.mode === "PROJECT" && !slug) exitProject(false);
  else if (s.mode !== "PROJECT" && slug) enterProject(slug, "index");
  else if (s.mode === "PROJECT" && slug && slug !== s.selectedSlug) {
    const dir = projectIndex(slug) > projectIndex(s.selectedSlug) ? 1 : -1;
    switchProject(slug, dir, false);
  }
});

window.__world = world; // handy for debugging in the console

// "Welcome to my portfolio": shown after the intro until the first scroll / swipe / key / click,
// then the 3D strip glides in. Navigation stays usable (opening Full / Profile also dismisses it).
function showWelcome(text, next) {
  const el = document.querySelector(".welcome");
  const root = document.documentElement;
  if (!el) return next();
  el.querySelector(".wl-title").textContent = text;
  el.hidden = false;
  root.setAttribute("data-welcome", "");
  window.gsap.fromTo(el.children, { opacity: 0, y: 16 }, { opacity: 1, y: 0, duration: 1, ease: "power3.out", stagger: 0.12 });
  let gone = false;
  const leave = (e) => {
    if (gone) return;
    if (e?.type === "keydown" && !["ArrowDown", "ArrowRight", "PageDown", " ", "Enter"].includes(e.key)) return;
    if (e?.type === "wheel") e.preventDefault();
    gone = true;
    cleanup();
    root.removeAttribute("data-welcome");
    window.gsap.to(el.children, { opacity: 0, y: -18, duration: 0.6, ease: "power2.in", onComplete: () => (el.hidden = true) });
    next();
  };
  const unsub = store.subscribe((s) => s.mode !== "WORLD" && leave());
  const cleanup = () => {
    el.removeEventListener("wheel", leave);
    el.removeEventListener("pointerdown", leave);
    el.removeEventListener("touchmove", leave);
    removeEventListener("keydown", leave);
    unsub?.();
  };
  el.addEventListener("wheel", leave, { passive: false });
  el.addEventListener("pointerdown", leave);
  el.addEventListener("touchmove", leave, { passive: true });
  addEventListener("keydown", leave);
}

initFocusDesc(world, projects);
