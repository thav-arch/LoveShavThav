import "server-only";
import { asc, count, eq, inArray } from "drizzle-orm";
import type { Actor } from "../auth/rbac";
import { assertCan } from "../auth/rbac";
import { db, schema } from "../db";
import { categoryInput, slugify, tagInput } from "../validation";
import { parse, uniqueSlug } from "./common";

const { categories, tags, projectTags, postTags } = schema;

export async function listCategories() {
  return db.select().from(categories).orderBy(asc(categories.name));
}

export async function listTagsWithCounts() {
  const rows = await db.select().from(tags).orderBy(asc(tags.name));
  const [p, q] = await Promise.all([
    db.select({ id: projectTags.tagId, n: count() }).from(projectTags).groupBy(projectTags.tagId),
    db.select({ id: postTags.tagId, n: count() }).from(postTags).groupBy(postTags.tagId),
  ]);
  const uses = new Map<string, number>();
  for (const r of [...p, ...q]) uses.set(r.id, (uses.get(r.id) ?? 0) + Number(r.n));
  return rows.map((t) => ({ ...t, uses: uses.get(t.id) ?? 0 }));
}

export async function saveCategory(user: Actor, id: string | null, input: unknown) {
  assertCan(user, id ? "update" : "create", "taxonomy");
  const data = parse(categoryInput, input);
  const slug = await uniqueSlug(categories, data.slug, data.name, id ?? undefined);
  const values = { name: data.name, slug, description: data.description || null, scope: data.scope };
  if (id) await db.update(categories).set(values).where(eq(categories.id, id));
  else await db.insert(categories).values(values);
}

export async function deleteCategory(user: Actor, id: string) {
  assertCan(user, "delete", "taxonomy");
  // projects/posts keep existing; their category is set to null by the FK
  await db.delete(categories).where(eq(categories.id, id));
}

export async function renameTag(user: Actor, id: string, input: unknown) {
  assertCan(user, "update", "taxonomy");
  const { name } = parse(tagInput, input);
  await db.update(tags).set({ name, slug: await uniqueSlug(tags, name, name, id) }).where(eq(tags.id, id));
}

export async function deleteTag(user: Actor, id: string) {
  assertCan(user, "delete", "taxonomy");
  await db.delete(tags).where(eq(tags.id, id));
}

/**
 * Resolve tag names to ids, creating missing tags. Creating tags inline from
 * a content form is allowed for anyone who may write content.
 */
export async function ensureTags(names: string[]) {
  const clean = [...new Map(names.map((n) => [slugify(n), n.trim()])).entries()].filter(([s]) => s);
  if (!clean.length) return [];
  const slugs = clean.map(([s]) => s);
  const existing = await db.select().from(tags).where(inArray(tags.slug, slugs));
  const have = new Set(existing.map((t) => t.slug));
  const missing = clean.filter(([s]) => !have.has(s)).map(([slug, name]) => ({ slug, name }));
  const created = missing.length ? await db.insert(tags).values(missing).onConflictDoNothing().returning() : [];
  const all = [...existing, ...created];
  // in case of a concurrent insert, re-read anything not returned
  if (all.length < slugs.length) return (await db.select().from(tags).where(inArray(tags.slug, slugs))).map((t) => t.id);
  return all.map((t) => t.id);
}
