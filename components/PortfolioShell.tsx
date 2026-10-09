"use client";

import dynamic from "next/dynamic";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { Project } from "@/lib/project-types";
import { projectIndex, setProjects } from "@/lib/projects";
import { motion, positionFor } from "@/lib/motion";
import { usePortfolio } from "@/lib/store";
import { exitProject, playIntro, setMode } from "@/lib/transitions";
import { CustomCursor } from "./CustomCursor";
import { FilmLoader } from "./FilmLoader";
import { Navigation } from "./Navigation";
import { ProfileContent, type ProfileData } from "./ProfileContent";
import { ProjectIndex } from "./ProjectIndex";
import { ProjectTransition } from "./ProjectTransition";

const PortfolioScene = dynamic(() => import("./PortfolioScene"), { ssr: false });

const slugFromPath = (path: string) => (path.startsWith("/projects/") ? decodeURIComponent(path.split("/")[2] ?? "") : null);
/** editorial pages that cover the 3D world like a case study */
const isPagePath = (path: string) => path.startsWith("/journal") || path.startsWith("/about");

export type WorldTheme = typeof motion.theme;

/**
 * Persistent shell for the public site. The WebGL world, cursor, navigation
 * and overlays live here and survive route changes, so moving between "/",
 * "/projects/[slug]", "/journal" and "/about" is a client-side transition,
 * never a reload. Route pages only render their DOM on top.
 *
 * Content (projects, profile, WebGL theme) arrives from the CMS as props.
 */
export function PortfolioShell({
  children,
  projects,
  profile,
  theme,
}: {
  children: React.ReactNode;
  projects: Project[];
  profile: ProfileData;
  theme: WorldTheme;
}) {
  // register before the world renders (idempotent; live binding for the 3D code)
  setProjects(projects);
  Object.assign(motion.theme, theme);

  const pathname = usePathname();
  const router = useRouter();
  const mode = usePortfolio((s) => s.mode);
  const booted = useRef(false);
  // the film-reel loader only plays when the visit starts on the 3D world
  const [showLoader] = useState(() => pathname === "/");

  // first load: deep links straight to a project or page skip the intro
  useEffect(() => {
    if (booted.current) return;
    booted.current = true;
    const slug = slugFromPath(pathname);
    const i = slug ? projectIndex(slug) : -1;
    if (i >= 0) {
      motion.pos = motion.target = positionFor(i, 0);
      usePortfolio.getState().set({ mode: "PROJECT", activeIndex: i, selectedSlug: slug, openedFrom: "direct" });
      playIntro(true);
    } else if (isPagePath(pathname)) {
      usePortfolio.getState().set({ mode: "PAGE" });
      playIntro(true);
    }
    // otherwise the film loader opens its shutters and the carousel plays the intro
  }, [pathname]);

  // route changes that didn't go through a transition (links, back / forward)
  useEffect(() => {
    if (!booted.current) return;
    const s = usePortfolio.getState();
    if (s.transition !== "idle") return;
    const slug = slugFromPath(pathname);
    if (isPagePath(pathname)) {
      if (s.mode !== "PAGE") {
        motion.portal.open = 0;
        s.set({ mode: "PAGE" });
      }
    } else if (!slug && s.mode === "PROJECT") exitProject(null);
    else if (!slug && s.mode === "PAGE") {
      motion.worldVis = 1;
      motion.intro = 1;
      s.set({ mode: "WORLD" });
    } else if (slug) {
      const i = projectIndex(slug);
      if (i >= 0 && (s.mode !== "PROJECT" || i !== s.activeIndex)) {
        motion.pos = motion.target = positionFor(i, motion.pos);
        s.set({ mode: "PROJECT", activeIndex: i, selectedSlug: slug });
      }
    }
  }, [pathname]);

  // Escape always steps back toward the world
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      const s = usePortfolio.getState();
      if (s.mode === "PROJECT") exitProject(router);
      else if (s.mode === "PAGE") router.push("/");
      else if (s.mode !== "WORLD") setMode("WORLD");
    };
    addEventListener("keydown", onKey);
    return () => removeEventListener("keydown", onKey);
  }, [router]);

  // remount the 3D scene only when the published set of cards changes
  const sceneKey = projects.map((p) => `${p.id}:${p.thumbnail}`).join("|");

  return (
    <div className="shell" data-mode={mode}>
      <PortfolioScene key={sceneKey} />
      <ProjectIndex />
      <ProfileContent profile={profile} />
      <Navigation />
      {children}
      <ProjectTransition />
      <CustomCursor />
      {showLoader && <FilmLoader />}
    </div>
  );
}
