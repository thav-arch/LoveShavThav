"use client";

import gsap from "gsap";
import Link from "next/link";
import { useEffect, useRef } from "react";
import { useEditorialScroll } from "./useEditorialScroll";

/**
 * Light editorial page shell for /journal and /about (same visual language
 * as the case studies) layered over the paused 3D world.
 */
export function EditorialPage({ label, children }: { label: string; children: React.ReactNode }) {
  const wrapper = useRef<HTMLDivElement>(null);
  const content = useRef<HTMLDivElement>(null);
  useEditorialScroll(wrapper, content);

  useEffect(() => {
    const intro = content.current?.querySelectorAll("[data-intro]") ?? [];
    gsap.fromTo(wrapper.current, { opacity: 0 }, { opacity: 1, duration: 0.5, ease: "power2.out" });
    gsap.fromTo(intro, { y: 50, opacity: 0 }, { y: 0, opacity: 1, duration: 1.1, ease: "expo.out", stagger: 0.06, delay: 0.1 });
  }, []);

  return (
    <div ref={wrapper} className="cs" data-case-study tabIndex={-1}>
      <header className="cs-bar">
        <Link className="cs-home" href="/">
          Thavanesh Nagarajan
        </Link>
        <nav className="cs-pager" aria-label="Sections">
          <Link href="/journal" aria-current={label === "Journal" ? "page" : undefined}>
            Journal
          </Link>
          <Link href="/about" aria-current={label === "About" ? "page" : undefined}>
            About
          </Link>
        </nav>
        <Link className="cs-close" href="/" aria-label="Back to the work">
          Work <span aria-hidden="true">×</span>
        </Link>
      </header>
      <div ref={content} className="cs-content">
        {children}
        <footer className="cs-foot">
          <Link href="/">← Back to the world</Link>
          <span>© {new Date().getFullYear()} Thavanesh Nagarajan</span>
        </footer>
      </div>
    </div>
  );
}
