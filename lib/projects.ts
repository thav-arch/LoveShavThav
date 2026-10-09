import type { Project } from "./project-types";

/**
 * Client-side registry of published projects. The server loads them from the
 * CMS and <PortfolioShell> registers them once, before the 3D world renders.
 * `projects` is a live binding: importers always see the current list.
 */
export let projects: Project[] = [];
const listeners = new Set<() => void>();

export function setProjects(list: Project[]) {
  if (list === projects) return;
  projects = list;
  listeners.forEach((fn) => fn());
}

export const onProjectsChange = (fn: () => void) => {
  listeners.add(fn);
  return () => void listeners.delete(fn);
};

export const getProject = (slug: string) => projects.find((p) => p.slug === slug);
export const projectIndex = (slug: string) => projects.findIndex((p) => p.slug === slug);
export type { Project };
