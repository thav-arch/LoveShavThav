// Songs of Saaja: the scroll-linked drawing (progress trail, journey lines, outlines, nodes, connectors,
// footprints, the moving strip) and the linked hover between the level maps and their beat charts.
// Ported from components/stories/SongsOfSaaja.tsx. The page's HTML is projects/songs-of-saaja.html.
import { editorialScroll } from "../page-effects.js";

export function mount(cs) {
  const el = cs.querySelector(".sj");
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const undoScroll = editorialScroll(cs);

  /* ---------------------------------------------------------- scroll-linked drawing */
  const trail = [...el.querySelectorAll(".sj-trail-mask path")];
  const lens = trail.map((p) => p.getTotalLength());
  const total = lens.reduce((a, b) => a + b, 0);
  trail.forEach((p, i) => (p.style.strokeDasharray = `${lens[i]} ${lens[i]}`));
  const trailBox = el.querySelector(".sj-trail");
  const nodes = [...el.querySelectorAll("[data-node]")];
  const linked = [...el.querySelectorAll("[data-sp]")];
  const drawn = [...el.querySelectorAll("[data-draw]")];
  const pans = [...el.querySelectorAll("[data-pan]")];
  const clamp = (n) => Math.min(1, Math.max(0, n));
  let raf = 0;
  const update = () => {
    raf = 0;
    const vh = innerHeight;
    if (trailBox) {
      const r = trailBox.getBoundingClientRect();
      // the tip of the trail follows a point a little below the middle of the screen
      const p = reduced ? 1 : clamp((vh * 0.62 - r.top) / r.height);
      let left = p * total;
      trail.forEach((path, i) => {
        const d = Math.min(lens[i], Math.max(0, left));
        left -= lens[i];
        path.style.strokeDashoffset = String(lens[i] - d);
      });
    }
    for (const n of nodes) n.toggleAttribute("data-lit", reduced || n.getBoundingClientRect().top < vh * 0.62);
    for (const n of linked) {
      const r = n.getBoundingClientRect();
      if (r.bottom < -vh || r.top > vh * 2) continue;
      n.style.setProperty("--sp", (reduced ? 1 : clamp((vh * 0.92 - r.top) / (vh * 0.62))).toFixed(3));
    }
    // lines drawn by scroll: the tip stays a little below the middle of the screen
    for (const n of drawn) {
      const r = n.getBoundingClientRect();
      if (r.bottom < -vh || r.top > vh * 2) continue;
      n.style.setProperty("--d", (reduced ? 1 : clamp((vh * 0.7 - r.top) / Math.max(r.height, vh * 0.25))).toFixed(4));
    }
    // the Gond art strip travels sideways while it crosses the screen
    for (const n of pans) {
      const r = n.getBoundingClientRect();
      if (r.bottom < -vh || r.top > vh * 2) continue;
      n.style.setProperty("--pan", (reduced ? 0.5 : clamp((vh - r.top) / (vh + r.height))).toFixed(4));
    }
  };
  const onScroll = () => {
    if (!raf) raf = requestAnimationFrame(update);
  };
  update();
  const late = setTimeout(update, 500);
  cs.addEventListener("scroll", onScroll, { passive: true });
  addEventListener("resize", onScroll);

  /* ------------------------------------------- map spots <-> beat chart rows (hover) */
  // map i belongs to chart i; a spot's rows are read from its aria-label ("Name: beat 2, 3")
  const maps = [...el.querySelectorAll(".sj-map")];
  const tables = [...el.querySelectorAll(".sj-table")];
  const cleanups = [];
  maps.forEach((map, i) => {
    const table = tables[i];
    if (!table) return;
    const rows = [...table.querySelectorAll("tbody tr")];
    const spots = [...map.querySelectorAll(".sj-spot")];
    const spotRows = spots.map((s) =>
      (s.getAttribute("aria-label").split("beat")[1] || "")
        .split(",")
        .map((n) => parseInt(n, 10) - 1)
        .filter((n) => n >= 0),
    );
    let beat = null; // row hovered in the chart
    let spot = null; // rows of the spot hovered on the map
    const render = () => {
      const active = spot ?? (beat != null ? [beat] : []);
      rows.forEach((r, n) => r.toggleAttribute("data-on", active.includes(n)));
      spots.forEach((s, n) => s.toggleAttribute("data-on", spotRows[n].some((r) => active.includes(r))));
    };
    const on = (node, type, fn) => {
      node.addEventListener(type, fn);
      cleanups.push(() => node.removeEventListener(type, fn));
    };
    rows.forEach((r, n) => {
      on(r, "mouseenter", () => ((beat = n), render()));
      on(r, "focus", () => ((beat = n), render()));
    });
    on(table.querySelector("tbody"), "mouseleave", () => ((beat = null), render()));
    spots.forEach((s, n) => {
      on(s, "mouseenter", () => ((spot = spotRows[n]), render()));
      on(s, "mouseleave", () => ((spot = null), render()));
      on(s, "focus", () => ((spot = spotRows[n]), render()));
      on(s, "blur", () => ((spot = null), render()));
    });
  });

  return () => {
    clearTimeout(late);
    cancelAnimationFrame(raf);
    cs.removeEventListener("scroll", onScroll);
    removeEventListener("resize", onScroll);
    cleanups.forEach((f) => f());
    undoScroll();
  };
}

// opened on its own (not loaded by the 3D home page)
if (document.body.hasAttribute("data-standalone")) {
  mount(document.querySelector(".cs"));
}
