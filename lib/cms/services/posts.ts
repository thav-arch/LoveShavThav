import "server-only";
import { and, asc, desc, eq, ilike, or, type SQL } from "drizzle-orm";
import { can, ForbiddenError, type Actor } from "../auth/rbac";
import { db, schema } from "../db";
import type { Status } from "../db/schema";
import { postInput, rawStatus } from "../validation";
import { checkContentWrite, parse, recordSlugChange, ServiceError, uniqueSlug } from "./common";
import { ensureTags } from "./taxonomy";

const { posts, postTags, tags, users, categories } = schema;

export async function listPosts(f: { q?: string; status?: Status | "" } = {}) {
  const where: SQL[] = [];
  if (f.q) where.push(or(ilike(posts.title, `%${f.q}%`), ilike(posts.slug, `%${f.q}%`))!);
  if (f.status) where.push(eq(posts.status, f.status));
  return db
    .select({
      id: posts.id,
      title: posts.title,
      slug: posts.slug,
      status: posts.status,
      publishedAt: posts.publishedAt,
      updatedAt: posts.updatedAt,
      authorId: posts.authorId,
      author: users.name,
      category: categories.name,
    })
    .from(posts)
    .leftJoin(users, eq(users.id, posts.authorId))
    .leftJoin(categories, eq(categories.id, posts.categoryId))
    .where(where.length ? and(...where) : undefined)
    .orderBy(desc(posts.updatedAt));
}

export async function getPost(id: string) {
  const row = (await db.select().from(posts).where(eq(posts.id, id)).limit(1))[0];
  if (!row) return null;
  const t = await db
    .select({ name: tags.name })
    .from(postTags)
    .innerJoin(tags, eq(tags.id, postTags.tagId))
    .where(eq(postTags.postId, id))
    .orderBy(asc(tags.name));
  return { ...row, tags: t.map((x) => x.name) };
}

export async function savePost(user: Actor, id: string | null, input: unknown) {
  // permissions first: an unauthorised caller gets 403, not validation details
  const existing = id ? await getPost(id) : null;
  if (id && !existing) throw new ServiceError("Post not found.", 404);
  checkContentWrite(user, existing, rawStatus(input));
  const data = parse(postInput, input);

  const slug = await uniqueSlug(posts, data.slug, data.title, id ?? undefined);
  // an explicit date can schedule a post in the future
  const chosen = data.publishedAt ? new Date(data.publishedAt) : null;
  const publishedAt =
    data.status === "published" ? (chosen ?? existing?.publishedAt ?? new Date()) : (chosen ?? existing?.publishedAt ?? null);
  const values = {
    title: data.title,
    slug,
    excerpt: data.excerpt,
    body: data.body,
    coverId: data.coverId,
    categoryId: data.categoryId,
    seo: data.seo,
    status: data.status,
    publishedAt,
  };

  let postId = id;
  if (existing) {
    await db.update(posts).set(values).where(eq(posts.id, existing.id));
    await recordSlugChange("/journal", existing.slug, slug);
  } else {
    const [row] = await db
      .insert(posts)
      .values({ ...values, authorId: user.id })
      .returning({ id: posts.id });
    postId = row.id;
  }
  const tagIds = await ensureTags(data.tags);
  await db.delete(postTags).where(eq(postTags.postId, postId!));
  if (tagIds.length) await db.insert(postTags).values(tagIds.map((tagId) => ({ postId: postId!, tagId })));
  return { id: postId!, slug };
}

/** partial update (REST PATCH): fields you don't send keep their current value */
export async function patchPost(user: Actor, id: string, partial: Record<string, unknown>) {
  const p = await getPost(id);
  if (!p) throw new ServiceError("Post not found.", 404);
  const merged: Record<string, unknown> = {
    title: p.title,
    slug: p.slug,
    excerpt: p.excerpt,
    body: p.body,
    coverId: p.coverId ?? "",
    categoryId: p.categoryId ?? "",
    tags: p.tags.join("\n"),
    seo: p.seo,
    status: p.status,
    publishedAt: p.publishedAt?.toISOString() ?? "",
    ...partial,
  };
  if (Array.isArray(merged.tags)) merged.tags = (merged.tags as string[]).join("\n");
  return savePost(user, id, merged);
}

export async function deletePost(user: Actor, id: string) {
  const row = (await db.select({ authorId: posts.authorId, status: posts.status }).from(posts).where(eq(posts.id, id)))[0];
  if (!row) throw new ServiceError("Post not found.", 404);
  const own = user.role === "author" && row.authorId === user.id && row.status !== "published";
  if (!can(user, "delete", "content") && !own) throw new ForbiddenError();
  await db.delete(posts).where(eq(posts.id, id));
}
