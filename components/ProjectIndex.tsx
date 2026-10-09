"use client";

import gsap from "gsap";
import { useRouter } from "next/navigation";
import { Fragment, useEffect, useRef, useState } from "react";
import { projects } from "@/lib/projects";
import { clamp, damp } from "@/lib/motion";
import { usePortfolio } from "@/lib/store";
import { enterProject } from "@/lib/transitions";

/**
 * FULL view: the carousel drops away and the projects become a typographic
 * index. Hovering a title floats a tilted preview card that trails the
 * pointer; clicking expands that card into the case study.
 */
export function ProjectIndex() {
  const mode = usePortfolio((s) => s.mode);
  const router = useRouter();
  const on = mode === "INDEX";
  const list = useRef<HTMLDivElement>(null);
  const preview = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<number | null>(null);
  const hoverRef = useRef<number | null>(null);
  hoverRef.current = hover;

  // staggered rise of the titles
  useEffect(() => {
    if (!on || !list.current) return;
    const words = list.current.querySelectorAll(".idx-rise");
    // y: 0 on both ends — GSAP would otherwise absorb the CSS translateY(115%) into y
    const tw = gsap.fromTo(
      words,
      { y: 0, yPercent: 115, rotate: 3 },
      { y: 0, yPercent: 0, rotate: 0, duration: 1.1, ease: "expo.out", stagger: 0.06, delay: 0.35 },
    );
    return () => {
      tw.kill();
    };
  }, [on]);

  useEffect(() => {
    if (!on) setHover(null);
  }, [on]);

  // preview card follows the pointer with lag and velocity-based tilt
  useEffect(() => {
    if (!on) return;
    const el = preview.current!;
    let x = innerWidth / 2;
    let y = innerHeight / 2;
    let tx = x;
    let ty = y;
    let s = 0;
    let rot = 0;
    let last = performance.now();
    let raf = 0;
    const onMove = (e: PointerEvent) => {
      tx = e.clientX;
      ty = e.clientY;
    };
    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const px = x;
      x = damp(x, tx, 9, dt);
      y = damp(y, ty, 9, dt);
      rot = damp(rot, clamp(((x - px) / Math.max(dt, 0.001)) * 0.012, -14, 14), 6, dt);
      s = damp(s, hoverRef.current === null ? 0 : 1, 10, dt);
      el.style.transform = `translate3d(${x}px, ${y}px, 0) translate(-50%, -50%) perspective(800px) rotateY(${rot * 1.4}deg) rotateZ(${rot * 0.5}deg) scale(${0.6 + 0.4 * s})`;
      el.style.opacity = String(s);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    addEventListener("pointermove", onMove);
    return () => {
      cancelAnimationFrame(raf);
      removeEventListener("pointermove", onMove);
      el.style.opacity = "0";
    };
  }, [on]);

  const open = (i: number, button: HTMLElement) => {
    const usePreview = hoverRef.current === i && Number(preview.current?.style.opacity) > 0.5;
    enterProject(projects[i].slug, router, "index", usePreview ? preview.current : button);
  };

  return (
    <section className="index" data-on={on || undefined} aria-hidden={!on} aria-label="All projects">
      <div ref={list} className="idx-list" data-hovering={hover !== null || undefined}>
        {projects.map((p, i) => (
          <Fragment key={p.slug}>
            <button
              className="idx-item"
              data-cursor="OPEN"
              data-active={hover === i || undefined}
              tabIndex={on ? 0 : -1}
              onPointerEnter={(e) => e.pointerType === "mouse" && setHover(i)}
              onPointerLeave={() => setHover(null)}
              onFocus={() => setHover(i)}
              onBlur={() => setHover(null)}
              onClick={(e) => open(i, e.currentTarget)}
            >
              <span className="idx-mask">
                <span className="idx-rise">
                  <sup>{String(i + 1).padStart(2, "0")}</sup>
                  {p.title}
                </span>
              </span>
            </button>
            {i < projects.length - 1 && (
              <span className="idx-dot" aria-hidden="true">
                <span className="idx-mask">
                  <span className="idx-rise">·</span>
                </span>
              </span>
            )}
          </Fragment>
        ))}
      </div>
      <p className="idx-caption">
        {hover !== null ? `${projects[hover].subtitle} — ${projects[hover].year}` : `${projects.length} projects`}
      </p>

      <div ref={preview} className="idx-preview" aria-hidden="true">
        {projects.map((p, i) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img key={p.slug} src={p.thumbnailSmall} alt="" data-on={hover === i || undefined} loading="lazy" />
        ))}
      </div>
    </section>
  );
}
