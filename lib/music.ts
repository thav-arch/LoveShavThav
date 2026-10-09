import { z } from "zod";

/**
 * Background music, set in the dashboard.
 *
 *  Settings → Music      site-wide: on/off, how it starts, overall volume,
 *                        a default track and one slot per page type
 *  Project → Music       each project: use the default, its own track, or silence
 *
 * Every slot is "default" (use the next level up), "custom" (its own track and
 * volume) or "off" (silence on that page). The site player (components/
 * MusicPlayer.tsx) picks the track for the current address and crossfades
 * between pages; visitors get play/pause and their own volume slider.
 */

/** a file from the media library (/uploads/…) or the site's own /projects/… folder */
const audioUrl = z.union([z.literal(""), z.string().trim().regex(/^\/(uploads|projects)\/[\w./-]+$/, "Pick an audio file from the media library")]);
const level = z.coerce.number().min(0).max(1);

export const trackSchema = z.object({
  url: audioUrl.default(""),
  title: z.string().trim().max(80).default(""),
  /** this track's own loudness, 0–1 (to even out tracks mastered at different levels) */
  volume: level.default(0.8),
});
export const slotSchema = trackSchema.extend({
  mode: z.enum(["default", "custom", "off"]).default("default"),
});

export const MUSIC_PAGES = ["home", "projects", "journal", "about"] as const;
export type MusicPage = (typeof MUSIC_PAGES)[number];

export const musicSchema = z.object({
  enabled: z.coerce.boolean(),
  /** browsers only allow sound after the visitor interacts with the page */
  start: z.enum(["button", "interaction"]),
  /** overall loudness, 0–1 */
  volume: level,
  /** crossfade between pages, seconds */
  fade: z.coerce.number().min(0).max(6),
  /** lower the music while a video on the page plays */
  duck: z.coerce.boolean(),
  default: trackSchema,
  home: slotSchema,
  projects: slotSchema,
  journal: slotSchema,
  about: slotSchema,
});

export type Track = z.infer<typeof trackSchema>;
export type MusicSlot = z.infer<typeof slotSchema>;
export type MusicSettings = z.infer<typeof musicSchema>;

const emptySlot: MusicSlot = { mode: "default", url: "", title: "", volume: 0.8 };
export const defaultMusic: MusicSettings = {
  enabled: false,
  start: "button",
  volume: 0.6,
  fade: 1.6,
  duck: true,
  default: { url: "", title: "", volume: 0.8 },
  home: emptySlot,
  projects: emptySlot,
  journal: emptySlot,
  about: emptySlot,
};

/** what the player needs: the settings plus each project's own slot */
export type MusicPlan = MusicSettings & { perProject: Record<string, MusicSlot> };

/** the track for an address, or null for silence */
export function trackFor(path: string, plan: MusicPlan): Track | null {
  if (!plan.enabled) return null;
  const fallback = plan.default.url ? plan.default : null;
  const pick = (slot: MusicSlot | undefined, parent: Track | null): Track | null =>
    !slot || slot.mode === "default" ? parent : slot.mode === "off" ? null : slot.url ? slot : parent;

  const [, first = "", second = ""] = path.split("/");
  if (first === "projects") {
    const projects = pick(plan.projects, fallback);
    return second ? pick(plan.perProject[decodeURIComponent(second)], projects) : projects;
  }
  if (first === "journal") return pick(plan.journal, fallback);
  if (first === "about") return pick(plan.about, fallback);
  return pick(plan.home, fallback);
}
