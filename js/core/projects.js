// Ported from lib/projects.ts (types stripped; logic unchanged)
/**
 * Client-side registry of published projects. The server loads them from the
 * CMS and <PortfolioShell> registers them once, before the 3D world renders.
 * `projects` is a live binding: importers always see the current list.
 */
export let projects = [];
const listeners = new Set();
export function setProjects(list) {
    if (list === projects)
        return;
    projects = list;
    listeners.forEach((fn) => fn());
}
export const onProjectsChange = (fn) => {
    listeners.add(fn);
    return () => void listeners.delete(fn);
};
export const getProject = (slug) => projects.find((p) => p.slug === slug);
export const projectIndex = (slug) => projects.findIndex((p) => p.slug === slug);
