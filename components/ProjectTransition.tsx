/**
 * Full-screen overlay used by every project transition (driven from
 * lib/transitions.ts): an image layer for the index → project expand and a
 * white wash that bridges the dark world and the light case study.
 */
export function ProjectTransition() {
  return (
    <div id="project-transition" className="pt" aria-hidden="true">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className="pt-media" alt="" />
      <div className="pt-white" />
    </div>
  );
}
