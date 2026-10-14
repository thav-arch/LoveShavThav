// Two lines about the project in focus, shown just above its card on the 3D strip (text: "description" in
// js/data.js). It fades out while the strip moves and back in once it settles on a project.
import { activeProjectIndex, motion } from "../core/motion.js";
import * as store from "../core/store.js";

export function initFocusDesc(world, projects) {
  const el = document.querySelector(".focus-desc");
  if (!el || !world?.centreRect) return;
  const html = document.documentElement;
  let shown = -1;
  let swapAt = 0;
  const loop = (now) => {
    requestAnimationFrame(loop);
    const s = store.state;
    const idx = activeProjectIndex();
    const settled = Math.abs(motion.pos - Math.round(motion.pos)) < 0.08 && Math.abs(motion.vel) < 0.4;
    const ok = s.mode === "WORLD" && s.introDone && s.transition === "idle" && motion.fly === 0 && !html.hasAttribute("data-intro") && !html.hasAttribute("data-welcome");
    if (idx !== shown) {
      // fade out, then swap the text
      el.removeAttribute("data-on");
      if (!swapAt) swapAt = now + 220;
      if (now >= swapAt) {
        el.textContent = projects[idx]?.description || "";
        shown = idx;
        swapAt = 0;
      }
      return;
    }
    const on = ok && settled && el.textContent;
    el.toggleAttribute("data-on", !!on);
    if (on) {
      const r = world.centreRect();
      el.style.maxWidth = `${Math.max(240, (r.right - r.left) * 0.92)}px`;
      el.style.transform = `translate3d(${r.left}px, ${r.top - el.offsetHeight - 14}px, 0)`;
    }
  };
  requestAnimationFrame(loop);
}
