"use client";

import { projects } from "@/lib/projects";
import { usePortfolio } from "@/lib/store";
import { setMode, togglePortal } from "@/lib/transitions";

const pad = (n: number) => String(n).padStart(2, "0");

/** The four corner controls plus a tiny position counter. Hidden on case studies. */
export function Navigation() {
  const mode = usePortfolio((s) => s.mode);
  const active = usePortfolio((s) => s.activeIndex);
  const introDone = usePortfolio((s) => s.introDone);

  return (
    <nav className="nav" data-hidden={mode === "PROJECT" || mode === "PAGE" || undefined} aria-label="Portfolio">
      <button className="nav-tl" data-cursor="HOME" onClick={() => setMode("WORLD")}>
        Thavanesh Nagarajan
      </button>

      <button
        className="nav-tr"
        data-cursor={mode === "PROFILE" ? "CLOSE" : "OPEN"}
        aria-expanded={mode === "PROFILE"}
        onClick={() => togglePortal("PROFILE")}
      >
        {mode === "PROFILE" ? "Close" : "Profile"}
      </button>

      <div className="nav-bl">
        <button data-cursor="FEATURED" aria-pressed={mode !== "INDEX"} onClick={() => setMode("WORLD")}>
          <span data-on={mode !== "INDEX" || undefined}>Featured</span>
        </button>
        <i aria-hidden="true">/</i>
        <button data-cursor="INDEX" aria-pressed={mode === "INDEX"} onClick={() => setMode("INDEX")}>
          <span data-on={mode === "INDEX" || undefined}>Full</span>
        </button>
      </div>

      <div className="nav-counter" aria-live="polite" data-hidden={mode !== "WORLD" || !introDone || undefined}>
        <span>{pad(active + 1)}</span>
        <span className="nav-counter-bar">
          <span style={{ transform: `scaleX(${(active + 1) / projects.length})` }} />
        </span>
        <span>{pad(projects.length)}</span>
      </div>

      <button
        className="nav-br"
        data-cursor={mode === "PLAYGROUND" ? "CLOSE" : "OPEN"}
        aria-expanded={mode === "PLAYGROUND"}
        onClick={() => togglePortal("PLAYGROUND")}
      >
        {mode === "PLAYGROUND" ? "Close" : "Playground"}
      </button>
    </nav>
  );
}
