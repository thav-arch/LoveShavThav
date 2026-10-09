import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { PostForm } from "@/components/admin/PostForm";
import { can } from "@/lib/cms/auth/rbac";
import { requireUser } from "@/lib/cms/auth/session";
import { db, schema } from "@/lib/cms/db";
import { getPost } from "@/lib/cms/services/posts";
import { listCategories } from "@/lib/cms/services/taxonomy";

export const metadata = { title: "Edit post" };

/** Date → value for <input type="datetime-local"> in the server's local time */
const local = (d: Date | null) => (d ? new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16) : "");

export default async function EditPost({ params }: PageProps<"/admin/posts/[id]">) {
  const user = await requireUser();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const [p, categories] = await Promise.all([getPost(id), listCategories()]);
  if (!p) notFound();
  const cover = p.coverId ? (await db.select().from(schema.media).where(eq(schema.media.id, p.coverId)))[0] : null;
  const ownDraft = p.authorId === user.id && p.status !== "published";

  return (
    <div className="a-page">
      <PostForm
        id={p.id}
        categories={categories.filter((c) => c.scope !== "project")}
        canPublish={can(user, "publish", "content")}
        canDelete={can(user, "delete", "content") || (user.role === "author" && ownDraft)}
        initial={{
          title: p.title,
          slug: p.slug,
          excerpt: p.excerpt,
          body: p.body,
          cover: cover ? { id: cover.id, url: cover.variants.sm ?? cover.url } : null,
          categoryId: p.categoryId ?? "",
          tags: p.tags,
          seo: { title: "", description: "", ogImage: "", canonical: "", noindex: false, ...p.seo },
          status: p.status,
          publishedAt: local(p.publishedAt),
        }}
      />
    </div>
  );
}
