import { z } from "zod";
import { GALLERY_LAYOUTS, TEXT_PLACEMENTS } from "../gallery";
import { CARD_LAYOUTS } from "../cards";
import { DIVIDERS, EDGES, HEADINGS, SECTION_KINDS, TONES } from "../blocks";
import { HERO_STYLES, PAGE_TEMPLATES, THEME_FONTS } from "../project-theme";
import { slotSchema } from "../music";
import { ALIGNS, MOBILE_ORDERS, OVERLAY_POS, OVERLAY_STYLES, SPACINGS, SPLITS, VALIGNS, WIDTHS } from "../section-design";

/** slug: lowercase words separated by single hyphens */
export const slugify = (s: string) =>
  s
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);

const slug = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use lowercase letters, numbers and hyphens")
  .max(80);

const status = z.enum(["draft", "published", "archived"]);
const uuidOrEmpty = z
  .union([z.literal(""), z.string().uuid()])
  .default("")
  .transform((v) => (v === "" ? null : v));
/** status from an unvalidated payload (for permission checks before validation) */
export const rawStatus = (input: unknown) => {
  const s = (input as { status?: unknown } | null)?.status;
  return s === "published" || s === "archived" ? s : "draft";
};
const safeUrl = z
  .string()
  .trim()
  .refine((v) => v === "" || /^https?:\/\//i.test(v) || v.startsWith("/"), "Must start with http(s):// or /");
const lines = (max: number) =>
  z
    .string()
    .default("")
    .transform((v) =>
      v
        .split(/[\n,]/)
        .map((s) => s.trim())
        .filter(Boolean)
        .slice(0, max),
    );

export const seoSchema = z.object({
  title: z.string().trim().max(70).optional().default(""),
  description: z.string().trim().max(170).optional().default(""),
  ogImage: safeUrl.optional().default(""),
  canonical: safeUrl.optional().default(""),
  noindex: z.coerce.boolean().optional().default(false),
});

export const galleryItemSchema = z.object({
  type: z.enum(["image", "video"]).default("image"),
  url: safeUrl.refine((v) => v !== "", "Image URL is required"),
  sm: safeUrl.optional(),
  w: z.coerce.number().int().positive().max(20000).optional(),
  h: z.coerce.number().int().positive().max(20000).optional(),
  alt: z.string().trim().max(300).default(""),
  caption: z.string().trim().max(200).optional(),
  featured: z.coerce.boolean().optional(),
  tone: z.array(z.number().min(0).max(1)).length(9).optional(),
});

/** section composition — every field optional, missing = auto (lib/section-design.ts) */
export const designSchema = z.object({
  split: z.enum(SPLITS).optional(),
  valign: z.enum(VALIGNS).optional(),
  align: z.enum(ALIGNS).optional(),
  width: z.enum(WIDTHS).optional(),
  spacing: z.enum(SPACINGS).optional(),
  overlayPos: z.enum(OVERLAY_POS).optional(),
  overlayStyle: z.enum(OVERLAY_STYLES).optional(),
  mobile: z.enum(MOBILE_ORDERS).optional(),
  tone: z.enum(TONES).optional(),
  edge: z.enum(EDGES).optional(),
  heading: z.enum(HEADINGS).optional(),
  chips: z.enum(["outline", "solid"]).optional(),
});

const ornamentSchema = z.object({
  url: safeUrl.refine((v) => v !== "", "Ornament image is required"),
  side: z.enum(["left", "right"]).default("left"),
  top: z.coerce.number().min(-20).max(120).default(10),
  width: z.coerce.number().min(20).max(1200).default(200),
  spin: z.coerce.boolean().optional(),
  flip: z.coerce.boolean().optional(),
});

const tableSchema = z.object({
  header: z.coerce.boolean().default(true),
  rows: z.array(z.array(z.string().trim().max(400)).max(12)).max(80).default([]),
});

const boardSchema = z.object({
  center: galleryItemSchema.nullable().default(null),
  refs: z
    .array(z.object({ label: z.string().trim().max(80).default(""), image: galleryItemSchema, side: z.enum(["left", "right"]).default("left") }))
    .max(8)
    .default([]),
});

export const cardSchema = z.object({
  title: z.string().trim().min(1, "Card title is required").max(100),
  body: z.string().trim().max(1200).default(""),
  tag: z.string().trim().max(120).optional(),
  image: galleryItemSchema.optional(),
});

export const sectionSchema = z.object({
  id: z.string().trim().min(1).max(60),
  title: z.string().trim().min(1, "Section title is required").max(80),
  body: z.string().max(20000).default(""),
  // legacy single media (kept so older sections keep working)
  mediaUrl: safeUrl.nullable().optional(),
  mediaType: z.enum(["image", "video"]).optional(),
  caption: z.string().trim().max(200).optional(),
  // image section
  items: z.array(galleryItemSchema).max(40, "At most 40 images per section").default([]),
  layout: z.enum(GALLERY_LAYOUTS).default("auto"),
  text: z.enum(TEXT_PLACEMENTS).default("auto"),
  columns: z.coerce.number().int().min(0).max(4).default(0),
  design: designSchema.default({}),
  // card section (numbered steps)
  kind: z.enum(SECTION_KINDS).default("media"),
  cards: z.array(cardSchema).max(24, "At most 24 cards per section").default([]),
  cardLayout: z.enum(CARD_LAYOUTS).default("auto"),
  // shared extras (lib/blocks.ts)
  subtitle: z.string().trim().max(120).optional(),
  chips: z.array(z.string().trim().min(1).max(160)).max(6).default([]),
  ornaments: z.array(ornamentSchema).max(8).default([]),
  table: tableSchema.optional(),
  board: boardSchema.optional(),
  divider: z.enum(DIVIDERS).optional(),
});

export const linkSchema = z.object({ label: z.string().trim().min(1).max(40), url: safeUrl });

const hexOrEmpty = z
  .string()
  .trim()
  .refine((v) => v === "" || /^#[0-9a-fA-F]{6}$/.test(v), "Use a hex colour like #c68c72")
  .optional();

/** per-project look (lib/project-theme.ts) */
export const projectThemeSchema = z.object({
  mode: z.enum(["site", "custom"]).optional(),
  bg: hexOrEmpty,
  ink: hexOrEmpty,
  alt: hexOrEmpty,
  altInk: hexOrEmpty,
  accent: hexOrEmpty,
  accent2: hexOrEmpty,
  chip: hexOrEmpty,
  font: z.enum(THEME_FONTS).optional(),
  heroStyle: z.enum(HERO_STYLES).optional(),
  band: safeUrl.optional(),
  template: z.enum(PAGE_TEMPLATES).optional(),
  music: slotSchema.optional(),
});

export const projectInput = z.object({
  title: z.string().trim().min(1, "Title is required").max(120),
  slug: z.union([z.literal(""), slug]).default(""),
  subtitle: z.string().trim().max(120).default(""),
  summary: z.string().trim().max(600).default(""),
  year: z.string().trim().max(20).default(""),
  role: z.string().trim().max(120).default(""),
  tools: lines(20),
  tags: lines(20),
  accent: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Use a hex colour like #de6e40").default("#888888"),
  categoryId: uuidOrEmpty,
  coverId: uuidOrEmpty,
  heroId: uuidOrEmpty,
  videoUrl: safeUrl.default(""),
  links: z.array(linkSchema).max(10).default([]),
  sections: z.array(sectionSchema).max(30).default([]),
  seo: seoSchema.default({ title: "", description: "", ogImage: "", canonical: "", noindex: false }),
  theme: projectThemeSchema.default({}),
  status: status.default("draft"),
  featured: z.coerce.boolean().default(true),
});
export type ProjectInput = z.infer<typeof projectInput>;

export const postInput = z.object({
  title: z.string().trim().min(1, "Title is required").max(140),
  slug: z.union([z.literal(""), slug]).default(""),
  excerpt: z.string().trim().max(400).default(""),
  body: z.string().max(100000).default(""),
  coverId: uuidOrEmpty,
  categoryId: uuidOrEmpty,
  tags: lines(20),
  seo: seoSchema.default({ title: "", description: "", ogImage: "", canonical: "", noindex: false }),
  status: status.default("draft"),
  publishedAt: z
    .string()
    .trim()
    .default("")
    .refine((v) => v === "" || !Number.isNaN(Date.parse(v)), "Invalid date"),
});
export type PostInput = z.infer<typeof postInput>;

export const categoryInput = z.object({
  name: z.string().trim().min(1).max(60),
  slug: z.union([z.literal(""), slug]).default(""),
  description: z.string().trim().max(300).default(""),
  scope: z.enum(["project", "post", "any"]).default("any"),
});

export const tagInput = z.object({ name: z.string().trim().min(1).max(40) });

/** flatten zod issues into { field: message } for forms */
export function fieldErrors(err: z.ZodError) {
  const out: Record<string, string> = {};
  for (const i of err.issues) {
    const k = i.path.join(".") || "_";
    if (!out[k]) out[k] = i.message;
  }
  return out;
}
