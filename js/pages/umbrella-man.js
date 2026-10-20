// The Umbrella Man: text that rises into place, a thin reading-progress line at the top, and photos that
// lift under the pointer (CSS). The trailer is a YouTube embed in the page itself.
// The page's HTML is projects/umbrella-man.html.
import { editorialScroll } from "../page-effects.js";

export function mount(cs) {
  const um = cs.querySelector(".um");
  const undoScroll = editorialScroll(cs);

  /* ------------------------------------------------------------ text reveal */
  const texts = [...um.querySelectorAll(".um-t[data-r]")];
  um.classList.add("is-live");
  const io = new IntersectionObserver(
    (entries) => {
      entries
        .filter((e) => e.isIntersecting)
        .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top || a.boundingClientRect.left - b.boundingClientRect.left)
        .forEach((e, i) => {
          e.target.style.setProperty("--d", Math.min(i * 0.08, 0.4).toFixed(2) + "s"); // neighbours one after another
          e.target.classList.add("in");
          io.unobserve(e.target);
        });
    },
    { root: cs, rootMargin: "0px 0px -8% 0px", threshold: 0.15 },
  );
  texts.forEach((el) => io.observe(el));

  /* ------------------------------------------------------- reading progress */
  const bar = cs.querySelector(".um-progress");
  let raf = 0;
  const progress = () => {
    raf = 0;
    const max = cs.scrollHeight - cs.clientHeight;
    bar?.style.setProperty("--p", max > 0 ? (cs.scrollTop / max).toFixed(4) : "0");
  };
  const onScroll = () => {
    if (!raf) raf = requestAnimationFrame(progress);
  };
  cs.addEventListener("scroll", onScroll, { passive: true });
  progress();

  return () => {
    io.disconnect();
    cancelAnimationFrame(raf);
    cs.removeEventListener("scroll", onScroll);
    undoScroll();
  };
}

// opened on its own (not loaded by the 3D home page)
if (document.body.hasAttribute("data-standalone")) {
  mount(document.querySelector(".cs"));
}
