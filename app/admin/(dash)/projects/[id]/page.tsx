import { inArray, or } from "drizzle-orm";
import type { GalleryItem } from "@/lib/gallery";
import { notFound } from "next/navigation";
import { ProjectForm } from "@/components/admin/ProjectForm";
import { can } from "@/lib/cms/auth/rbac";
import { requireUser } from "@/lib/cms/auth/session";
import { db, schema } from "@/lib/cms/db";
import { getProject } from "@/lib/cms/services/projects";
import { listCategories } from "@/lib/cms/services/taxonomy";

export const metadata = { title: "Edit project" };

export default async function EditProject({ params }: PageProps<"/admin/projects/[id]">) {
  const user = await requireUser();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const [p, categories] = await Promise.all([getProject(id), listCategories()]);
  if (!p) notFound();

  // section images: gallery items, or the older single image/video as a one-item gallery
  const sectionItems = p.sections.map((s): GalleryItem[] =>
    s.items?.length ? s.items : s.mediaUrl ? [{ type: s.mediaType ?? "image", url: s.mediaUrl, alt: "", caption: s.caption ?? "" }] : [],
  );
  const missing = sectionItems.flat().filter((it) => !it.w).map((it) => it.url);
  const mediaIds = [p.coverId, p.heroId].filter((x): x is string => !!x);
  const media = mediaIds.length || missing.length
    ? await db
        .select()
        .from(schema.media)
        .where(or(mediaIds.length ? inArray(schema.media.id, mediaIds) : undefined, missing.length ? inArray(schema.media.url, missing) : undefined))
    : [];
  const ref = (mid: string | null) => {
    const m = media.find((x) => x.id === mid);
    return m ? { id: m.id, url: m.variants.sm ?? m.url } : null;
  };
  const fill = (it: GalleryItem): GalleryItem => {
    if (it.w) return it;
    const m = media.find((x) => x.url === it.url);
    return m ? { ...it, w: m.width ?? undefined, h: m.height ?? undefined, sm: it.sm || m.variants.sm || undefined, tone: it.tone ?? m.variants.tone, alt: it.alt || m.alt } : it;
  };
  const isOwnDraft = p.authorId === user.id && p.status !== "published";

  return (
    <div className="a-page">
      <ProjectForm
        id={p.id}
        categories={categories.filter((c) => c.scope !== "post")}
        canPublish={can(user, "publish", "content")}
        canDelete={can(user, "delete", "content") || (user.role === "author" && isOwnDraft)}
        initial={{
          title: p.title,
          slug: p.slug,
          subtitle: p.subtitle,
          summary: p.summary,
          year: p.year,
          role: p.role,
          tools: p.tools,
          tags: p.tags,
          accent: p.accent,
          categoryId: p.categoryId ?? "",
          cover: ref(p.coverId),
          hero: ref(p.heroId),
          videoUrl: p.videoUrl ?? "",
          links: p.links,
          sections: p.sections.map((s, n) => ({
            id: s.id,
            title: s.title,
            body: s.body,
            items: sectionItems[n].map(fill),
            layout: s.layout ?? "auto",
            text: s.text ?? (s.items ? "auto" : "top"), // older sections keep "text above"
            columns: s.columns ?? 0,
            design: s.design ?? {},
            kind: s.kind ?? "media",
            cards: (s.cards ?? []).map((c) => ({ ...c, tag: c.tag ?? "" })),
            cardLayout: s.cardLayout ?? "auto",
            subtitle: s.subtitle ?? "",
            chips: s.chips ?? [],
            ornaments: s.ornaments ?? [],
            table: s.table ?? { header: true, rows: [] },
            board: s.board ?? { center: null, refs: [] },
            divider: s.divider ?? "footprints",
          })),
          theme: { mode: "site", ...p.theme },
          seo: { title: "", description: "", ogImage: "", canonical: "", noindex: false, ...p.seo },
          status: p.status,
          featured: p.featured,
        }}
      />
    </div>
  );
}
