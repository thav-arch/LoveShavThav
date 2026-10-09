import { sql } from "drizzle-orm";
import type { GalleryItem, GalleryLayout, TextPlacement } from "../../gallery";
import type { SectionDesign } from "../../section-design";
import type { Card, CardLayout } from "../../cards";
import type { BoardData, DividerStyle, Ornament, SectionKind, TableData } from "../../blocks";
import type { ProjectTheme } from "../../project-theme";
import {
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

/**
 * CMS schema (PostgreSQL). Runs unchanged on PGlite (local dev, no install)
 * and on any hosted Postgres (Neon, Supabase, RDS…) in production.
 */

export const roleEnum = pgEnum("role", ["admin", "editor", "author"]);
export const statusEnum = pgEnum("status", ["draft", "published", "archived"]);

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
};

/* ------------------------------------------------------------------ auth */

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  passwordHash: text("password_hash").notNull(),
  role: roleEnum("role").notNull().default("author"),
  lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
  ...timestamps,
});

export const sessions = pgTable(
  "sessions",
  {
    /** sha-256 of the cookie token — the raw token is never stored */
    id: text("id").primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    userAgent: text("user_agent"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("sessions_user_idx").on(t.userId)],
);

/* ------------------------------------------------------------- taxonomy */

export const categories = pgTable("categories", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  description: text("description"),
  /** which content this category applies to */
  scope: text("scope", { enum: ["project", "post", "any"] }).notNull().default("any"),
  ...timestamps,
});

export const tags = pgTable("tags", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/* ---------------------------------------------------------------- media */

/** sm: 480px preview · tone: 3×3 brightness map (lib/cms/tone.ts) */
export type MediaVariants = { sm?: string; tone?: number[] };

export const media = pgTable(
  "media",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    url: text("url").notNull(),
    filename: text("filename").notNull(),
    mimeType: text("mime_type").notNull(),
    size: integer("size").notNull().default(0),
    width: integer("width"),
    height: integer("height"),
    alt: text("alt").notNull().default(""),
    variants: jsonb("variants").$type<MediaVariants>().notNull().default({}),
    uploadedBy: uuid("uploaded_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("media_created_idx").on(t.createdAt)],
);

/* -------------------------------------------------------------- content */

export type Seo = {
  title?: string;
  description?: string;
  ogImage?: string;
  canonical?: string;
  noindex?: boolean;
};

export type ProjectSectionData = {
  id: string;
  title: string;
  body: string;
  /** legacy single image/video (sections saved before image layouts) */
  mediaId?: string | null;
  mediaUrl?: string | null;
  mediaType?: "image" | "video";
  caption?: string;
  /** image section: items + layout + text placement (lib/gallery.ts) */
  items?: GalleryItem[];
  layout?: GalleryLayout;
  text?: TextPlacement;
  /** grid columns / carousel size / rows density — 0 = auto */
  columns?: number;
  /** how text and images are composed (lib/section-design.ts) */
  design?: SectionDesign;
  /** what the section holds (lib/blocks.ts): images (default), cards, table, board, divider */
  kind?: SectionKind;
  cards?: Card[];
  cardLayout?: CardLayout;
  /** small line under the heading (e.g. "Design Process") */
  subtitle?: string;
  /** pills after the text, e.g. "Story → Character → Theme" */
  chips?: string[];
  ornaments?: Ornament[];
  table?: TableData;
  board?: BoardData;
  divider?: DividerStyle;
};

export type LinkData = { label: string; url: string };

export const projects = pgTable(
  "projects",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    slug: text("slug").notNull().unique(),
    title: text("title").notNull(),
    subtitle: text("subtitle").notNull().default(""),
    summary: text("summary").notNull().default(""),
    year: text("year").notNull().default(""),
    role: text("role").notNull().default(""),
    tools: text("tools").array().notNull().default(sql`'{}'::text[]`),
    accent: text("accent").notNull().default("#888888"),
    categoryId: uuid("category_id").references(() => categories.id, { onDelete: "set null" }),
    coverId: uuid("cover_id").references(() => media.id, { onDelete: "set null" }),
    heroId: uuid("hero_id").references(() => media.id, { onDelete: "set null" }),
    videoUrl: text("video_url"),
    links: jsonb("links").$type<LinkData[]>().notNull().default([]),
    sections: jsonb("sections").$type<ProjectSectionData[]>().notNull().default([]),
    seo: jsonb("seo").$type<Seo>().notNull().default({}),
    /** per-project look of the case study (lib/project-theme.ts) */
    theme: jsonb("theme").$type<ProjectTheme>().notNull().default({}),
    status: statusEnum("status").notNull().default("draft"),
    featured: boolean("featured").notNull().default(true),
    sortOrder: integer("sort_order").notNull().default(0),
    authorId: uuid("author_id").references(() => users.id, { onDelete: "set null" }),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    ...timestamps,
  },
  (t) => [index("projects_status_order_idx").on(t.status, t.sortOrder)],
);

export const posts = pgTable(
  "posts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    slug: text("slug").notNull().unique(),
    title: text("title").notNull(),
    excerpt: text("excerpt").notNull().default(""),
    body: text("body").notNull().default(""),
    coverId: uuid("cover_id").references(() => media.id, { onDelete: "set null" }),
    categoryId: uuid("category_id").references(() => categories.id, { onDelete: "set null" }),
    seo: jsonb("seo").$type<Seo>().notNull().default({}),
    status: statusEnum("status").notNull().default("draft"),
    authorId: uuid("author_id").references(() => users.id, { onDelete: "set null" }),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    ...timestamps,
  },
  (t) => [index("posts_status_published_idx").on(t.status, t.publishedAt)],
);

export const projectTags = pgTable(
  "project_tags",
  {
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    tagId: uuid("tag_id")
      .notNull()
      .references(() => tags.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.projectId, t.tagId] }), index("project_tags_tag_idx").on(t.tagId)],
);

export const postTags = pgTable(
  "post_tags",
  {
    postId: uuid("post_id")
      .notNull()
      .references(() => posts.id, { onDelete: "cascade" }),
    tagId: uuid("tag_id")
      .notNull()
      .references(() => tags.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.postId, t.tagId] }), index("post_tags_tag_idx").on(t.tagId)],
);

/**
 * Modular sections (testimonials, achievements, …). Each row belongs to a
 * collection defined in code (lib/cms/collections.ts) that describes and
 * validates its fields — adding a section type needs no migration.
 */
export const entries = pgTable(
  "entries",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    collection: text("collection").notNull(),
    data: jsonb("data").$type<Record<string, unknown>>().notNull().default({}),
    status: statusEnum("status").notNull().default("draft"),
    sortOrder: integer("sort_order").notNull().default(0),
    authorId: uuid("author_id").references(() => users.id, { onDelete: "set null" }),
    ...timestamps,
  },
  (t) => [index("entries_collection_idx").on(t.collection, t.status, t.sortOrder)],
);

/** site-wide settings documents: "site", "profile", "theme", "music" */
export const settings = pgTable("settings", {
  key: text("key").primaryKey(),
  value: jsonb("value").$type<Record<string, unknown>>().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

/** old URL → new URL, recorded automatically when a slug changes */
export const redirects = pgTable(
  "redirects",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    fromPath: text("from_path").notNull(),
    toPath: text("to_path").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("redirects_from_idx").on(t.fromPath)],
);

export type User = typeof users.$inferSelect;
export type Role = User["role"];
export type Status = (typeof statusEnum.enumValues)[number];
export type ProjectRow = typeof projects.$inferSelect;
export type PostRow = typeof posts.$inferSelect;
export type MediaRow = typeof media.$inferSelect;
export type EntryRow = typeof entries.$inferSelect;
export type CategoryRow = typeof categories.$inferSelect;
export type TagRow = typeof tags.$inferSelect;
