import "server-only";
import { and, asc, desc, eq, inArray, lte } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { unstable_cache } from "next/cache";
import { planGallery, ratioOf, type GalleryItem } from "@/lib/gallery";
import { resolveDesign } from "@/lib/section-design";
import { planCards } from "@/lib/cards";
import type { Project } from "@/lib/project-types";
import type { ProjectSectionData } from "./db/schema";
import { collections, type CollectionKey } from "./collections";
import { db, schema } from "./db";
import { readingMinutes, renderMarkdown } from "./markdown";
import { toneForUrl } from "./tone";
import { settingsDefs, type SettingsKey } from "./settings-schema";

/**
 * PUBLIC READS — everything the website renders goes through these cached
 * functions. Results are cached across requests and tagged by content type;
 * the admin actions invalidate exactly the tags they touch (lib/cms/revalidate.ts),
 * so pages stay static-fast but update the moment you hit Save.
 *
 * Only `published` content is ever returned here.
 */
export const TAGS = {
  projects: "cms:projects",
  posts: "cms:posts",
  entries: "cms:entries",
  settings: "cms:settings",
  taxonomy: "cms:taxonomy",
  redirects: "cms:redirects",
} as const;

const { projects, posts, media, categories, tags, projectTags, postTags, entries, settings, redirects } = schema;
const cover = alias(media, "cover");
const hero = alias(media, "hero");

/* --------------------------------------------------------------- projects */

async function loadProjects(): Promise<Project[]> {
  const rows = await db
    .select({
      p: projects,
      category: categories.name,
      coverUrl: cover.url,
      coverAlt: cover.alt,
      coverSm: cover.variants,
      coverW: cover.width,
      coverH: cover.height,
      heroUrl: hero.url,
    })
    .from(projects)
    .leftJoin(categories, eq(categories.id, projects.categoryId))
    .leftJoin(cover, eq(cover.id, projects.coverId))
    .leftJoin(hero, eq(hero.id, projects.heroId))
    .where(eq(projects.status, "published"))
    .orderBy(asc(projects.sortOrder), desc(projects.publishedAt));

  const tagMap = await tagsFor(
    "project",
    rows.map((r) => r.p.id),
  );
  const mediaInfo = await mediaByUrl(rows.flatMap((r) => r.p.sections.flatMap(allImages).filter((it) => !it.w || !it.tone).map((it) => it.url)));
  /** size, preview, brightness and alt filled in from the media library */
  const fill = (it: GalleryItem, alt: string): GalleryItem => {
    const m = mediaInfo.get(it.url);
    return { ...it, w: it.w ?? m?.width ?? undefined, h: it.h ?? m?.height ?? undefined, sm: it.sm || m?.sm || undefined, tone: it.tone ?? m?.tone, alt: it.alt || m?.alt || alt };
  };

  return Promise.all(rows.map(async ({ p, category, coverUrl, coverSm, coverW, coverH, heroUrl }) => {
    const thumb = coverUrl ?? `/projects/${p.slug}/thumbnail.jpg`;
    return {
      id: p.id,
      slug: p.slug,
      title: p.title,
      subtitle: p.subtitle,
      description: p.summary,
      year: p.year,
      category: category ?? p.subtitle,
      role: p.role,
      tags: tagMap.get(p.id) ?? [],
      tools: p.tools,
      accent: p.accent,
      // frame width on the film strip follows the cover (kept within a cinematic range)
      aspect: coverW && coverH ? Math.min(2.2, Math.max(1.2, coverW / coverH)) : undefined,
      thumbnail: thumb,
      thumbnailSmall: coverSm?.sm ?? thumb,
      hero: heroUrl ?? thumb,
      video: p.videoUrl || undefined,
      links: p.links,
      theme: p.theme,
      sections: await Promise.all(
        p.sections.map(async (s) => {
          const kind = s.kind ?? "media";
          const isCards = kind === "cards";
          const items = (kind === "media" ? sectionItems(s) : []).map((it, n, all) =>
            fill(it, `${p.title} — ${s.title}${all.length > 1 ? ` (${n + 1} of ${all.length})` : ""}`),
          );
          const textLength = plainLength(s.body);
          // layout + composition decided here, once per cache fill — the browser only renders it.
          // Sections saved before image layouts keep their original look (text above).
          const plan = items.length
            ? planGallery({ items, layout: s.layout, text: s.text ?? (s.items ? "auto" : "top"), columns: s.columns, textLength })
            : undefined;
          // card sections place their text above or beside the cards (no images to overlay)
          const placement =
            kind === "media" ? (plan?.text ?? "top") : s.text === "left" || s.text === "right" || s.text === "bottom" ? s.text : "top";
          const hero = plan && placement === "overlay" ? items[Math.max(0, plan.hero)] : undefined;
          // readable text over the image: measure older images that have no stored brightness map
          if (hero && !hero.tone && hero.type === "image" && (s.design?.overlayStyle ?? "auto") === "auto") hero.tone = await toneForUrl(hero.url);
          const design = resolveDesign(s.design, {
            placement,
            layout: plan?.layout,
            n: isCards ? (s.cards?.length ?? 0) : items.length,
            textLength,
            ratios: items.map(ratioOf),
            tone: hero?.tone,
          });
          return {
            id: s.id,
            title: s.title,
            body: s.body,
            html: renderMarkdown(s.body),
            placement,
            design,
            gallery: plan ? { items, plan } : undefined,
            cards:
              isCards && s.cards?.length
                ? {
                    items: s.cards.map((c) => (c.image ? { ...c, image: fill(c.image, `${p.title} — ${c.title}`) } : c)),
                    plan: planCards(s.cards, s.cardLayout),
                  }
                : undefined,
            subtitle: s.subtitle || undefined,
            chips: s.chips?.length ? s.chips : undefined,
            ornaments: s.ornaments?.length ? s.ornaments : undefined,
            table: kind === "table" && s.table?.rows.length ? s.table : undefined,
            board:
              kind === "board" && s.board
                ? {
                    center: s.board.center ? fill(s.board.center, `${p.title} — ${s.title}`) : null,
                    refs: s.board.refs.map((r) => ({ ...r, image: fill(r.image, r.label || s.title) })),
                  }
                : undefined,
            divider: kind === "divider" ? (s.divider ?? "rule") : undefined,
          };
        }),
      ),
    } satisfies Project;
  }));
}

/** every image a section references (gallery, card images, board) */
function allImages(s: ProjectSectionData): GalleryItem[] {
  return [
    ...sectionItems(s),
    ...(s.cards ?? []).flatMap((c) => (c.image ? [c.image] : [])),
    ...(s.board ? [...(s.board.center ? [s.board.center] : []), ...s.board.refs.map((r) => r.image)] : []),
  ];
}

/** a section's images: the gallery items, or the legacy single image/video */
function sectionItems(s: ProjectSectionData): GalleryItem[] {
  if (s.items?.length) return s.items;
  return s.mediaUrl ? [{ type: s.mediaType ?? "image", url: s.mediaUrl, alt: "", caption: s.caption || undefined }] : [];
}

/** rough reading length of Markdown (for the automatic text placement) */
const plainLength = (md: string) => md.replace(/!\[[^\]]*\]\([^)]*\)|[#>*_`~\-[\]()]|https?:\/\/\S+/g, "").replace(/\s+/g, " ").trim().length;

/** size, preview and alt text of library files referenced only by URL (one query) */
async function mediaByUrl(urls: string[]) {
  const map = new Map<string, { width: number | null; height: number | null; sm?: string; tone?: number[]; alt: string }>();
  const unique = [...new Set(urls)];
  if (!unique.length) return map;
  const rows = await db
    .select({ url: media.url, width: media.width, height: media.height, variants: media.variants, alt: media.alt })
    .from(media)
    .where(inArray(media.url, unique));
  for (const r of rows) map.set(r.url, { width: r.width, height: r.height, sm: r.variants?.sm, tone: r.variants?.tone, alt: r.alt });
  return map;
}

async function tagsFor(kind: "project" | "post", ids: string[]) {
  const map = new Map<string, string[]>();
  if (!ids.length) return map;
  const join = kind === "project" ? projectTags : postTags;
  const key = kind === "project" ? projectTags.projectId : postTags.postId;
  const rows = await db
    .select({ id: key, name: tags.name })
    .from(join)
    .innerJoin(tags, eq(tags.id, join.tagId))
    .where(inArray(key, ids))
    .orderBy(asc(tags.name));
  for (const r of rows) map.set(r.id, [...(map.get(r.id) ?? []), r.name]);
  return map;
}

export const getPublishedProjects = unstable_cache(loadProjects, ["cms-projects"], {
  tags: [TAGS.projects],
});

export async function getProjectBySlug(slug: string) {
  return (await getPublishedProjects()).find((p) => p.slug === slug) ?? null;
}

/** SEO overrides are kept separately so they don't bloat the 3D client payload */
export const getProjectSeo = unstable_cache(
  async (slug: string) => {
    const r = await db
      .select({ seo: projects.seo, updatedAt: projects.updatedAt, publishedAt: projects.publishedAt })
      .from(projects)
      .where(and(eq(projects.slug, slug), eq(projects.status, "published")))
      .limit(1);
    return r[0] ? { ...r[0], updatedAt: r[0].updatedAt.toISOString(), publishedAt: r[0].publishedAt?.toISOString() ?? null } : null;
  },
  ["cms-project-seo"],
  { tags: [TAGS.projects] },
);

/* ------------------------------------------------------------------ posts */

export type PostSummary = {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  cover: string | null;
  coverAlt: string;
  category: string | null;
  tags: string[];
  publishedAt: string;
  updatedAt: string;
  minutes: number;
};

export type PostFull = PostSummary & { html: string; seo: typeof posts.$inferSelect.seo; author: string | null };

async function loadPosts(): Promise<PostSummary[]> {
  const rows = await db
    .select({
      id: posts.id,
      slug: posts.slug,
      title: posts.title,
      excerpt: posts.excerpt,
      body: posts.body,
      cover: cover.url,
      coverAlt: cover.alt,
      category: categories.name,
      publishedAt: posts.publishedAt,
      updatedAt: posts.updatedAt,
    })
    .from(posts)
    .leftJoin(cover, eq(cover.id, posts.coverId))
    .leftJoin(categories, eq(categories.id, posts.categoryId))
    .where(and(eq(posts.status, "published"), lte(posts.publishedAt, new Date())))
    .orderBy(desc(posts.publishedAt));
  const tagMap = await tagsFor(
    "post",
    rows.map((r) => r.id),
  );
  return rows.map(({ body, ...r }) => ({
    ...r,
    coverAlt: r.coverAlt ?? "",
    tags: tagMap.get(r.id) ?? [],
    publishedAt: (r.publishedAt ?? r.updatedAt).toISOString(),
    updatedAt: r.updatedAt.toISOString(),
    minutes: readingMinutes(body),
  }));
}

// hourly revalidation also picks up posts scheduled for a future date
export const getPublishedPosts = unstable_cache(loadPosts, ["cms-posts"], { tags: [TAGS.posts], revalidate: 3600 });

export const getPostBySlug = unstable_cache(
  async (slug: string): Promise<PostFull | null> => {
    const summary = (await loadPosts()).find((p) => p.slug === slug);
    if (!summary) return null;
    const r = await db
      .select({ body: posts.body, seo: posts.seo, author: schema.users.name })
      .from(posts)
      .leftJoin(schema.users, eq(schema.users.id, posts.authorId))
      .where(eq(posts.id, summary.id))
      .limit(1);
    return { ...summary, html: renderMarkdown(r[0].body), seo: r[0].seo, author: r[0].author };
  },
  ["cms-post"],
  { tags: [TAGS.posts], revalidate: 3600 },
);

/* -------------------------------------------------------- modular entries */

export type PublicEntry = { id: string; data: Record<string, unknown> };

export const getEntries = unstable_cache(
  async (collection: CollectionKey): Promise<PublicEntry[]> => {
    if (!(collection in collections)) return [];
    const rows = await db
      .select({ id: entries.id, data: entries.data })
      .from(entries)
      .where(and(eq(entries.collection, collection), eq(entries.status, "published")))
      .orderBy(asc(entries.sortOrder), desc(entries.createdAt));
    return rows;
  },
  ["cms-entries"],
  { tags: [TAGS.entries] },
);

/* --------------------------------------------------------------- settings */

export const getSettings = unstable_cache(
  async <K extends SettingsKey>(key: K) => {
    const def = settingsDefs[key];
    const row = await db.select({ value: settings.value }).from(settings).where(eq(settings.key, key)).limit(1);
    // merge with defaults so new settings fields never break old data
    const merged = { ...def.defaults, ...(row[0]?.value ?? {}) };
    const parsed = def.schema.safeParse(merged);
    return (parsed.success ? parsed.data : def.defaults) as (typeof settingsDefs)[K]["defaults"];
  },
  ["cms-settings"],
  { tags: [TAGS.settings] },
);

/* ------------------------------------------------------- redirects / SEO */

export const getRedirect = unstable_cache(
  async (path: string) => {
    const r = await db.select({ to: redirects.toPath }).from(redirects).where(eq(redirects.fromPath, path)).limit(1);
    return r[0]?.to ?? null;
  },
  ["cms-redirect"],
  { tags: [TAGS.redirects] },
);

export const getCategoriesInUse = unstable_cache(
  async () => db.select({ id: categories.id, name: categories.name, slug: categories.slug }).from(categories).orderBy(asc(categories.name)),
  ["cms-categories"],
  { tags: [TAGS.taxonomy] },
);
