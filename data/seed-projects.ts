/**
 * SEED DATA — the original hard-coded portfolio content. It is only read by
 * `npm run db:seed` to fill an empty database; after that, edit projects in
 * the CMS dashboard (/admin). Copy marked DRAFT was written from titles and
 * tags only; years/roles for projects 02–05 are guesses.
 */

import type { Project, ProjectMedia } from "@/lib/project-types";

const asset = (slug: string, file: string) => `/projects/${slug}/${file}`;
const img = (slug: string, n: number, alt: string, caption?: string): ProjectMedia => ({
  type: "image",
  src: asset(slug, `0${n}.jpg`),
  alt,
  caption,
});
const clip = (slug: string, alt: string, caption?: string): ProjectMedia => ({
  type: "video",
  src: asset(slug, "gameplay.mp4"),
  alt,
  caption,
});

/** Builds the media paths from the slug so each entry only lists its content. */
function project(p: Omit<Project, "thumbnail" | "thumbnailSmall" | "hero" | "video"> & { video?: boolean }): Project {
  const { video = true, ...rest } = p;
  return {
    ...rest,
    thumbnail: asset(p.slug, "thumbnail.jpg"),
    thumbnailSmall: asset(p.slug, "thumbnail-sm.jpg"),
    hero: asset(p.slug, "hero.jpg"),
    video: video ? asset(p.slug, "gameplay.mp4") : undefined,
  };
}

export const seedProjects: Project[] = [
  project({
    id: "gond",
    slug: "gond",
    title: "GOND",
    subtitle: "Narrative 3D Adventure",
    description: "Narrative 3D adventure inspired by Gond folklore.",
    year: "2026",
    category: "Narrative 3D Adventure",
    role: "Game Designer / Narrative Designer",
    tags: ["Game Design", "Narrative Design", "Level Design", "World Building", "Unity", "Unreal Engine"],
    tools: ["Unity", "Unreal Engine"],
    accent: "#de6e40",
    sections: [
      { id: "process", title: "Process", body: "DRAFT — Research into Gond folklore, its oral storytelling and its dot-and-line visual language, translated into a set of design pillars for the world, its characters and its pacing.", media: img("gond", 1, "Gond process board") },
      { id: "gameplay", title: "Gameplay", body: "DRAFT — The core loop: explore, listen, and reshape the world through the stories the player uncovers.", media: clip("gond", "Gond gameplay capture") },
      { id: "system-design", title: "System Design", body: "DRAFT — How the narrative state, traversal and environmental interactions are connected, and what each system communicates to the player.", media: img("gond", 2, "Gond system diagram") },
      { id: "level-design", title: "Level Design", body: "DRAFT — Blockouts, sightlines and landmark placement used to guide the player through each chapter without explicit UI.", media: img("gond", 3, "Gond level blockout") },
      { id: "iteration", title: "Iteration", body: "DRAFT — What changed after playtests, and why." },
      { id: "prototype", title: "Prototype", body: "DRAFT — Prototype builds in Unity and Unreal Engine used to validate feel, scale and camera.", media: img("gond", 4, "Gond prototype screenshot") },
      { id: "outcome", title: "Outcome", body: "DRAFT — Where the project landed, what was learned, and what comes next." },
    ],
  }),
  project({
    id: "dabba-wala",
    slug: "dabba-wala",
    title: "DABBA WALA",
    subtitle: "2D Physics / Delivery Game",
    description: "DRAFT — A 2D physics delivery game about getting every lunchbox to the right hands, on time.",
    year: "2025",
    category: "2D Physics / Delivery Game",
    role: "Game Designer",
    tags: ["Game Design", "Game Feel", "Physics", "Level Design", "Unity"],
    tools: ["Unity"],
    accent: "#eebe2e",
    sections: [
      { id: "process", title: "Process", body: "DRAFT — Research, references and the first paper prototypes.", media: img("dabba-wala", 1, "Dabba Wala process") },
      { id: "gameplay", title: "Gameplay", body: "DRAFT — Balancing a stack of lunchboxes through a busy city: the core loop and its failure states.", media: clip("dabba-wala", "Dabba Wala gameplay") },
      { id: "game-feel", title: "Game Feel", body: "DRAFT — Tuning physics, weight, wobble and feedback so that every delivery feels physical and readable.", media: img("dabba-wala", 2, "Dabba Wala game feel tuning") },
      { id: "level-design", title: "Level Design", body: "DRAFT — Routes, obstacles and difficulty ramps.", media: img("dabba-wala", 3, "Dabba Wala level layout") },
      { id: "iteration", title: "Iteration", body: "DRAFT — Playtest findings and the changes they drove.", media: img("dabba-wala", 4, "Dabba Wala iteration") },
      { id: "outcome", title: "Outcome", body: "DRAFT — Results and reflections." },
    ],
  }),
  project({
    id: "umbrella-man",
    slug: "umbrella-man",
    title: "UMBRELLA MAN",
    subtitle: "Stop-Motion Narrative Game",
    description: "DRAFT — A narrative game built from hand-made stop-motion frames.",
    year: "2025",
    category: "Stop-Motion Narrative Game",
    role: "Narrative Designer / Art Director",
    tags: ["Narrative Design", "Stop Motion", "Game Design", "Art Direction"],
    tools: ["Stop Motion", "Unity"],
    accent: "#96bae6",
    sections: [
      { id: "process", title: "Process", body: "DRAFT — Story development, character design and the physical set.", media: img("umbrella-man", 1, "Umbrella Man set") },
      { id: "gameplay", title: "Gameplay", body: "DRAFT — How the player moves through the story.", media: clip("umbrella-man", "Umbrella Man gameplay") },
      { id: "art-direction", title: "Art Direction", body: "DRAFT — Materials, lighting and the stop-motion production pipeline.", media: img("umbrella-man", 2, "Umbrella Man art direction") },
      { id: "narrative", title: "Narrative Design", body: "DRAFT — Structure, beats and branching.", media: img("umbrella-man", 3, "Umbrella Man narrative structure") },
      { id: "prototype", title: "Prototype", body: "DRAFT — Early animation tests and interactive prototypes.", media: img("umbrella-man", 4, "Umbrella Man prototype") },
      { id: "outcome", title: "Outcome", body: "DRAFT — Results and reflections." },
    ],
  }),
  project({
    id: "elevator-empire",
    slug: "elevator-empire",
    title: "ELEVATOR EMPIRE",
    subtitle: "Management / Systems Game",
    description: "DRAFT — A management game about building, running and scaling a tower of elevators.",
    year: "2024",
    category: "Management / Systems Game",
    role: "Systems Designer",
    tags: ["System Design", "Progression", "Game Economy", "Unity"],
    tools: ["Unity", "Spreadsheets"],
    accent: "#e85c26",
    sections: [
      { id: "process", title: "Process", body: "DRAFT — Reference games, goals and the first economy model.", media: img("elevator-empire", 1, "Elevator Empire process") },
      { id: "gameplay", title: "Gameplay", body: "DRAFT — The moment-to-moment management loop.", media: clip("elevator-empire", "Elevator Empire gameplay") },
      { id: "system-design", title: "System Design", body: "DRAFT — Sources, sinks and the interactions between passengers, floors and upgrades.", media: img("elevator-empire", 2, "Elevator Empire systems map") },
      { id: "progression", title: "Progression", body: "DRAFT — Unlock pacing and the long-term goals that keep players building.", media: img("elevator-empire", 3, "Elevator Empire progression curve") },
      { id: "iteration", title: "Iteration", body: "DRAFT — Balancing passes and what the data showed.", media: img("elevator-empire", 4, "Elevator Empire balancing") },
      { id: "outcome", title: "Outcome", body: "DRAFT — Results and reflections." },
    ],
  }),
  project({
    id: "farmville-2-event-design",
    slug: "farmville-2-event-design",
    title: "FARMVILLE 2 EVENT DESIGN",
    subtitle: "Live-Ops Event Design",
    description: "DRAFT — Live-ops event design for FarmVille 2, focused on retention and player progression.",
    year: "2024",
    category: "Live-Ops Event Design",
    role: "Event Designer",
    tags: ["Live Ops", "Retention", "Event Design", "UX", "Player Progression"],
    tools: ["Figma", "Spreadsheets"],
    accent: "#ecdc78",
    sections: [
      { id: "process", title: "Process", body: "DRAFT — Player research, goals and the event brief.", media: img("farmville-2-event-design", 1, "FarmVille 2 event brief") },
      { id: "event-design", title: "Event Design", body: "DRAFT — Event structure, rewards and the calendar.", media: img("farmville-2-event-design", 2, "FarmVille 2 event structure") },
      { id: "progression", title: "Player Progression", body: "DRAFT — How the event ties into long-term progression.", media: img("farmville-2-event-design", 3, "FarmVille 2 progression") },
      { id: "ux", title: "UX", body: "DRAFT — Flows, screens and onboarding into the event.", media: img("farmville-2-event-design", 4, "FarmVille 2 event UX") },
      { id: "outcome", title: "Outcome", body: "DRAFT — Retention goals and reflections." },
    ],
    video: false,
  }),
];

