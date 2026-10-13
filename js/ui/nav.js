// Corner navigation, the position counter, and the DOM that reacts to the store (mode / active project).
// Ported from components/Navigation.tsx; the markup itself is in index.html.
import { projects } from "../core/projects.js";
import * as store from "../core/store.js";
import { setMode, togglePortal } from "./transitions.js";

const pad = (n) => String(n).padStart(2, "0");

export function initNav() {
  const $ = (s) => document.querySelector(s);
  const shell = $(".shell");
  const nav = $(".nav");
  const profileBtn = $(".nav-tr");
  const featured = $(".nav-featured");
  const full = $(".nav-full");
  const counter = $(".nav-counter");
  const counterNums = counter.querySelectorAll(":scope > span:not(.nav-counter-bar)");
  const counterBar = counter.querySelector(".nav-counter-bar span");
  const scene = $(".scene");
  const indexEl = $(".index");
  const profile = $(".portal-content");

  $(".nav-tl").addEventListener("click", () => setMode("WORLD"));

  // Resume menu: hover opens it (CSS); a click / tap on "Resume" toggles it (touch screens, keyboard);
  // a click elsewhere or Escape closes it
  const rs = $(".nav-rs");
  const rsBtn = $(".nav-rs-btn");
  const setResume = (open) => {
    rs.toggleAttribute("data-open", open);
    rsBtn.setAttribute("aria-expanded", String(open));
  };
  rsBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    setResume(!rs.hasAttribute("data-open"));
  });
  rs.addEventListener("focusout", (e) => !rs.contains(e.relatedTarget) && setResume(false));
  rs.querySelectorAll("a").forEach((a) => a.addEventListener("click", () => setResume(false)));
  document.addEventListener("pointerdown", (e) => !rs.contains(e.target) && setResume(false));
  addEventListener("keydown", (e) => e.key === "Escape" && setResume(false));
  profileBtn.addEventListener("click", () => togglePortal("PROFILE"));
  featured.addEventListener("click", () => setMode("WORLD"));
  full.addEventListener("click", () => setMode("INDEX"));
  counterNums[1].textContent = pad(projects.length);

  const render = (s) => {
    const { mode, transition, activeIndex, introDone } = s;
    shell.dataset.mode = mode;
    nav.toggleAttribute("data-hidden", mode === "PROJECT");
    profileBtn.textContent = mode === "PROFILE" ? "Close" : "Profile";
    profileBtn.setAttribute("aria-expanded", String(mode === "PROFILE"));
    featured.setAttribute("aria-pressed", String(mode !== "INDEX"));
    featured.firstElementChild.toggleAttribute("data-on", mode !== "INDEX");
    full.setAttribute("aria-pressed", String(mode === "INDEX"));
    full.firstElementChild.toggleAttribute("data-on", mode === "INDEX");
    counter.toggleAttribute("data-hidden", mode !== "WORLD" || !introDone);
    counterNums[0].textContent = pad(activeIndex + 1);
    counterBar.style.transform = `scaleX(${(activeIndex + 1) / projects.length})`;
    // the case study fully covers the canvas: hide it (the loop also stops, see world/scene.js)
    scene.toggleAttribute("data-covered", mode === "PROJECT" && transition === "idle");
    indexEl.toggleAttribute("data-on", mode === "INDEX");
    indexEl.setAttribute("aria-hidden", String(mode !== "INDEX"));
    profile.toggleAttribute("data-on", mode === "PROFILE");
    profile.setAttribute("aria-hidden", String(mode !== "PROFILE"));
    profile.querySelectorAll("a").forEach((a) => (a.tabIndex = mode === "PROFILE" ? 0 : -1));
    indexEl.querySelectorAll("button").forEach((b) => (b.tabIndex = mode === "INDEX" ? 0 : -1));
  };
  store.subscribe(render);
  render(store.state);
}
