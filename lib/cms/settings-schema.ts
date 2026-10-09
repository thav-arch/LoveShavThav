import { z } from "zod";
import { defaultMusic, musicSchema } from "../music";

/**
 * Site settings documents (stored as JSON in the `settings` table) with
 * defaults, so the site always renders even before anything is saved.
 */
const hex = z.string().regex(/^#[0-9a-fA-F]{6}$/, "Use a 6-digit hex colour like #ff8800");
const link = z.object({ label: z.string().trim().min(1).max(40), url: z.string().trim().url() });

export const siteSchema = z.object({
  title: z.string().trim().min(1).max(80),
  tagline: z.string().trim().max(120),
  description: z.string().trim().max(300),
  /** canonical origin used for SEO (sitemap, canonical URLs, JSON-LD) */
  url: z.string().trim().url(),
  ogImage: z.string().trim().max(500),
  twitter: z.string().trim().max(40),
});

export const profileSchema = z.object({
  name: z.string().trim().min(1).max(80),
  roles: z.array(z.string().trim().min(1).max(60)).max(6),
  intro: z.string().trim().max(600),
  education: z.array(z.string().trim().min(1).max(100)).max(6),
  skills: z.array(z.string().trim().min(1).max(40)).max(40),
  email: z.union([z.literal(""), z.string().trim().email()]),
  links: z.array(link).max(10),
});

export const FONTS = {
  "inter-tight": { label: "Inter Tight", variable: "--font-inter-tight" },
  "space-grotesk": { label: "Space Grotesk", variable: "--font-space-grotesk" },
  "dm-sans": { label: "DM Sans", variable: "--font-dm-sans" },
  syne: { label: "Syne", variable: "--font-syne" },
  "instrument-serif": { label: "Instrument Serif (display)", variable: "--font-instrument-serif" },
} as const;
export type FontKey = keyof typeof FONTS;
const fontKey = z.enum(Object.keys(FONTS) as [FontKey, ...FontKey[]]);

export const themeSchema = z.object({
  bg: hex,
  fg: hex,
  paper: hex,
  ink: hex,
  accent: hex,
  fontBody: fontKey,
  fontDisplay: fontKey,
  /** 0–1: rotates the glowing grid palette */
  gridHue: z.coerce.number().min(0).max(1),
  /** 0 = grid off, 1 = default, up to 2 */
  gridIntensity: z.coerce.number().min(0).max(2),
  cursorWake: z.coerce.boolean(),
  wakeStrength: z.coerce.number().min(0).max(0.05),
  /** card corner radius (in card-height units) */
  cardRadius: z.coerce.number().min(0).max(0.2),
  /** case-study / journal reading width */
  layout: z.enum(["editorial", "compact"]),
  uppercaseUi: z.coerce.boolean(),
});

export type SiteSettings = z.infer<typeof siteSchema>;
export type ProfileSettings = z.infer<typeof profileSchema>;
export type ThemeSettings = z.infer<typeof themeSchema>;

export const defaultSite: SiteSettings = {
  title: "Thavanesh Nagarajan — Game Designer",
  tagline: "Game Designer · Experience Designer",
  description:
    "Game designer and experience designer. Games, systems and interactive experiences at the intersection of gameplay, narrative, interaction and visual design.",
  url: process.env.SITE_URL ?? "http://localhost:3000",
  ogImage: "",
  twitter: "",
};

export const defaultProfile: ProfileSettings = {
  name: "Thavanesh Nagarajan",
  roles: ["Game Designer", "Experience Designer"],
  intro:
    "I design games, systems and interactive experiences at the intersection of gameplay, narrative, interaction and visual design.",
  education: ["Digital Game Design", "National Institute of Design", "Bengaluru, India"],
  skills: [
    "Game Design",
    "System Design",
    "Narrative Design",
    "Level Design",
    "UI / UX",
    "Interaction Design",
    "Prototyping",
    "Unity",
    "Unreal Engine",
    "Blender",
    "Figma",
  ],
  email: "",
  links: [],
};

export const defaultTheme: ThemeSettings = {
  bg: "#000000",
  fg: "#ffffff",
  paper: "#f1f0ec",
  ink: "#0b0b0b",
  accent: "#c9a7ff",
  fontBody: "inter-tight",
  fontDisplay: "inter-tight",
  gridHue: 0,
  gridIntensity: 1,
  cursorWake: true,
  wakeStrength: 0.018,
  cardRadius: 0.045,
  layout: "editorial",
  uppercaseUi: true,
};

export const settingsDefs = {
  site: { schema: siteSchema, defaults: defaultSite },
  profile: { schema: profileSchema, defaults: defaultProfile },
  theme: { schema: themeSchema, defaults: defaultTheme },
  music: { schema: musicSchema, defaults: defaultMusic },
} as const;
export type SettingsKey = keyof typeof settingsDefs;
