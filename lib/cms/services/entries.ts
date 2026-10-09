import "server-only";
import { and, asc, desc, eq, gt, lt, max } from "drizzle-orm";
import { can, ForbiddenError, type Actor } from "../auth/rbac";
import { collectionSchema, getCollection, type CollectionKey } from "../collections";
import { db, schema } from "../db";
import type { Status } from "../db/schema";
import { checkContentWrite, parse, ServiceError } from "./common";

const { entries } = schema;
const STATUSES: Status[] = ["draft", "published", "archived"];

export async function listEntries(collection: CollectionKey) {
  return db
    .select()
    .from(entries)
    .where(eq(entries.collection, collection))
    .orderBy(asc(entries.sortOrder), desc(entries.createdAt));
}

export async function getEntry(collection: CollectionKey, id: string) {
  return (
    (await db
      .select()
      .from(entries)
      .where(and(eq(entries.id, id), eq(entries.collection, collection)))
      .limit(1))[0] ?? null
  );
}

export async function saveEntry(user: Actor, collection: CollectionKey, id: string | null, input: Record<string, unknown>) {
  const status = (STATUSES.includes(input.status as Status) ? input.status : "draft") as Status;
  const data = parse(collectionSchema(getCollection(collection)), input.data ?? {});
  const existing = id ? await getEntry(collection, id) : null;
  if (id && !existing) throw new ServiceError("Item not found.", 404);
  checkContentWrite(user, existing, status);

  if (existing) {
    await db.update(entries).set({ data, status }).where(eq(entries.id, existing.id));
    return { id: existing.id };
  }
  const next = (await db.select({ m: max(entries.sortOrder) }).from(entries).where(eq(entries.collection, collection)))[0]?.m ?? 0;
  const [row] = await db
    .insert(entries)
    .values({ collection, data, status, authorId: user.id, sortOrder: Number(next) + 1 })
    .returning({ id: entries.id });
  return row;
}

export async function deleteEntry(user: Actor, collection: CollectionKey, id: string) {
  const row = await getEntry(collection, id);
  if (!row) return;
  const own = user.role === "author" && row.authorId === user.id && row.status !== "published";
  if (!can(user, "delete", "content") && !own) throw new ForbiddenError();
  await db.delete(entries).where(eq(entries.id, id));
}

export async function moveEntry(user: Actor, collection: CollectionKey, id: string, dir: -1 | 1) {
  if (!can(user, "publish", "content")) throw new ForbiddenError("Only editors can reorder.");
  const cur = await getEntry(collection, id);
  if (!cur) return;
  const n = (
    await db
      .select({ id: entries.id, o: entries.sortOrder })
      .from(entries)
      .where(and(eq(entries.collection, collection), dir < 0 ? lt(entries.sortOrder, cur.sortOrder) : gt(entries.sortOrder, cur.sortOrder)))
      .orderBy(dir < 0 ? desc(entries.sortOrder) : asc(entries.sortOrder))
      .limit(1)
  )[0];
  if (!n) return;
  await db.update(entries).set({ sortOrder: n.o }).where(eq(entries.id, cur.id));
  await db.update(entries).set({ sortOrder: cur.sortOrder }).where(eq(entries.id, n.id));
}
