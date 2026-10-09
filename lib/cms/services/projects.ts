import "server-only";
import { and, asc, desc, eq, gt, ilike, lt, max, or, type SQL } from "drizzle-orm";
import { ForbiddenError, type Actor, can } from "../auth/rbac";
import { db, schema } from "../db";
import type { Status } from "../db/schema";
import { projectInput, rawStatus } from "../validation";
import { checkContentWrite, parse, recordSlugChange, ServiceError, uniqueSlug } from "./common";
import { ensureTags } from "./taxonomy";

const { projects, projectTags, tags, categories, users } = schema;

export type ProjectListFilter = { q?: string; status?: Status | ""; categoryId?: string };

export async function listProjects(f: ProjectListFilter = {}) {
  const where: SQL[] = [];
  if (f.q) where.push(or(ilike(projects.title, `%${f.q}%`), ilike(projects.slug, `%${f.q}%`))!);
  if (f.status) where.push(eq(projects.status, f.status));
  if (f.categoryId) where.push(eq(projects.categoryId, f.categoryId));
  return db
    .select({
      id: projects.id,
      title: projects.title,
      slug: projects.slug,
      subtitle: projects.subtitle,
      status: projects.status,
      featured: projects.featured,
      sortOrder: projects.sortOrder,
      updatedAt: projects.updatedAt,
      authorId: projects.authorId,
      author: users.name,
      category: categories.name,
    })
    .from(projects)
    .leftJoin(users, eq(users.id, projects.authorId))
    .leftJoin(categories, eq(categories.id, projects.categoryId))
    .where(where.length ? and(...where) : undefined)
    .orderBy(asc(projects.sortOrder), desc(projects.updatedAt));
}

export async function getProject(id: string) {
  const row = (await db.select().from(projects).where(eq(projects.id, id)).limit(1))[0];
  if (!row) return null;
  const t = await db
    .select({ name: tags.name })
    .from(projectTags)
    .innerJoin(tags, eq(tags.id, projectTags.tagId))
    .where(eq(projectTags.projectId, id))
    .orderBy(asc(tags.name));
  return { ...row, tags: t.map((x) => x.name) };
}

export async function saveProject(user: Actor, id: string | null, input: unknown) {
  // permissions first: an unauthorised caller gets 403, not validation details
  const existing = id ? await getProject(id) : null;
  if (id && !existing) throw new ServiceError("Project not found.", 404);
  checkContentWrite(user, existing, rawStatus(input));
  const data = parse(projectInput, input);

  const slug = await uniqueSlug(projects, data.slug, data.title, id ?? undefined);
  const publishing = data.status === "published";
  const values = {
    title: data.title,
    slug,
    subtitle: data.subtitle,
    summary: data.summary,
    year: data.year,
    role: data.role,
    tools: data.tools,
    accent: data.accent,
    categoryId: data.categoryId,
    coverId: data.coverId,
    heroId: data.heroId,
    videoUrl: data.videoUrl || null,
    links: data.links,
    sections: data.sections.map((s) => ({ ...s, mediaUrl: s.mediaUrl || null })),
    seo: data.seo,
    theme: data.theme,
    status: data.status,
    featured: data.featured,
    publishedAt: publishing ? (existing?.publishedAt ?? new Date()) : (existing?.publishedAt ?? null),
  };

  let projectId = id;
  if (existing) {
    await db.update(projects).set(values).where(eq(projects.id, existing.id));
    await recordSlugChange("/projects", existing.slug, slug);
  } else {
    const next = (await db.select({ m: max(projects.sortOrder) }).from(projects))[0]?.m ?? 0;
    const [row] = await db
      .insert(projects)
      .values({ ...values, authorId: user.id, sortOrder: Number(next) + 1 })
      .returning({ id: projects.id });
    projectId = row.id;
  }

  const tagIds = await ensureTags(data.tags);
  await db.delete(projectTags).where(eq(projectTags.projectId, projectId!));
  if (tagIds.length) await db.insert(projectTags).values(tagIds.map((tagId) => ({ projectId: projectId!, tagId })));
  return { id: projectId!, slug };
}

/** current record in the same shape saveProject accepts */
function toInput(p: NonNullable<Awaited<ReturnType<typeof getProject>>>) {
  return {
    title: p.title,
    slug: p.slug,
    subtitle: p.subtitle,
    summary: p.summary,
    year: p.year,
    role: p.role,
    tools: p.tools.join("\n"),
    tags: p.tags.join("\n"),
    accent: p.accent,
    categoryId: p.categoryId ?? "",
    coverId: p.coverId ?? "",
    heroId: p.heroId ?? "",
    videoUrl: p.videoUrl ?? "",
    links: p.links,
    sections: p.sections,
    seo: p.seo,
    theme: p.theme,
    status: p.status,
    featured: p.featured,
  };
}

/** partial update (REST PATCH): fields you don't send keep their current value */
export async function patchProject(user: Actor, id: string, partial: Record<string, unknown>) {
  const existing = await getProject(id);
  if (!existing) throw new ServiceError("Project not found.", 404);
  const merged: Record<string, unknown> = { ...toInput(existing), ...partial };
  // arrays may also be sent as JSON arrays
  for (const k of ["tools", "tags"]) if (Array.isArray(merged[k])) merged[k] = (merged[k] as string[]).join("\n");
  return saveProject(user, id, merged);
}

export async function deleteProject(user: Actor, id: string) {
  const row = (await db.select({ authorId: projects.authorId, status: projects.status }).from(projects).where(eq(projects.id, id)))[0];
  if (!row) throw new ServiceError("Project not found.", 404);
  const own = user.role === "author" && row.authorId === user.id && row.status !== "published";
  if (!can(user, "delete", "content") && !own) throw new ForbiddenError();
  await db.delete(projects).where(eq(projects.id, id));
}

export async function setProjectStatus(user: Actor, id: string, status: Status) {
  if (!can(user, "publish", "content")) throw new ForbiddenError("Only editors can change publishing status.");
  const row = (await db.select({ publishedAt: projects.publishedAt }).from(projects).where(eq(projects.id, id)))[0];
  if (!row) throw new ServiceError("Project not found.", 404);
  await db
    .update(projects)
    .set({ status, publishedAt: status === "published" ? (row.publishedAt ?? new Date()) : row.publishedAt })
    .where(eq(projects.id, id));
}

/** swap with the neighbour above/below in the carousel order */
export async function moveProject(user: Actor, id: string, dir: -1 | 1) {
  if (!can(user, "publish", "content")) throw new ForbiddenError("Only editors can reorder projects.");
  const cur = (await db.select({ id: projects.id, o: projects.sortOrder }).from(projects).where(eq(projects.id, id)))[0];
  if (!cur) return;
  const neighbour = (
    await db
      .select({ id: projects.id, o: projects.sortOrder })
      .from(projects)
      .where(dir < 0 ? lt(projects.sortOrder, cur.o) : gt(projects.sortOrder, cur.o))
      .orderBy(dir < 0 ? desc(projects.sortOrder) : asc(projects.sortOrder))
      .limit(1)
  )[0];
  if (!neighbour) return;
  await db.update(projects).set({ sortOrder: neighbour.o }).where(eq(projects.id, cur.id));
  await db.update(projects).set({ sortOrder: cur.o }).where(eq(projects.id, neighbour.id));
}
