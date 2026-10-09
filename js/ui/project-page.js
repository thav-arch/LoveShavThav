// Case-study pages are plain HTML files (projects/<name>.html) that also work on their own. When a
// visitor opens one from the 3D world, the page's <div class="cs"> is fetched and placed over the
// (paused) world, together with the page's own stylesheets and script — so the 3D scene stays alive
// behind it and closing returns to the exact card.
//
// A page file contains:   <div class="cs" data-case-study> … </div>
//                         <link rel="stylesheet" href="css/…">          (paths relative to the site root,
//                         <script type="module" data-page src="js/…">    because the file sets <base href="../">)
// and its script exports  mount(csElement) → dispose function.

/** the address of the 3D home page, restored when a project is closed */
export const HOME_URL = location.href.split("#")[0];
// every path in a page file is relative to the site root, so resolve them against the home page (not the page's own URL)
const SITE = new URL(".", HOME_URL).href;
const abs = (u) => new URL(u, SITE).href;

const loaded = new Map(); // slug → Promise<{ root, mod }>
const ready = new Map(); // slug → { root, mod }
let current = null;

function addStylesheet(href) {
  const url = abs(href);
  const existing = [...document.querySelectorAll('link[rel="stylesheet"]')].find((l) => l.href === url);
  if (existing) return existing.sheet ? Promise.resolve() : new Promise((r) => existing.addEventListener("load", r, { once: true }));
  return new Promise((resolve) => {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = url;
    link.onload = link.onerror = () => resolve();
    document.head.appendChild(link);
  });
}

export function loadProjectPage(project) {
  let p = loaded.get(project.slug);
  if (!p) {
    p = (async () => {
      const res = await fetch(abs(project.page));
      if (!res.ok) throw new Error(`${project.page}: ${res.status}`);
      const doc = new DOMParser().parseFromString(await res.text(), "text/html");
      const root = doc.querySelector(".cs");
      if (!root) throw new Error(`${project.page}: no <div class="cs"> found`);
      // images etc. keep working after the address bar changes to projects/<name>.html
      root.querySelectorAll("[src], [poster]").forEach((el) => {
        for (const a of ["src", "poster"]) if (el.hasAttribute(a)) el.setAttribute(a, abs(el.getAttribute(a)));
      });
      const styles = [...doc.querySelectorAll('link[rel="stylesheet"]')].map((l) => l.getAttribute("href"));
      const script = doc.querySelector("script[data-page]")?.getAttribute("src");
      await Promise.all(styles.map(addStylesheet));
      const mod = script ? await import(abs(script)) : null;
      const out = { root, mod };
      ready.set(project.slug, out);
      return out;
    })();
    loaded.set(project.slug, p);
    p.catch(() => loaded.delete(project.slug)); // allow a retry
  }
  return p;
}

/** puts the (already loaded) page over the world; returns the content element */
export function mountProjectPage(project) {
  const { root, mod } = ready.get(project.slug);
  unmountProjectPage();
  const cs = document.importNode(root, true);
  document.querySelector(".shell").appendChild(cs);
  const dispose = mod?.mount?.(cs);
  cs.focus({ preventScroll: true });
  current = { cs, dispose };
  return cs.querySelector("[data-cs-content]");
}

export function unmountProjectPage() {
  if (!current) return;
  try {
    current.dispose?.();
  } catch (e) {
    console.error(e);
  }
  current.cs.remove();
  current = null;
}
