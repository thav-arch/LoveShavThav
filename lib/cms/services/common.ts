import "server-only";
import { and, eq, ne, or } from "drizzle-orm";
import type { PgColumn, PgTable } from "drizzle-orm/pg-core";
import type { z } from "zod";
import { can, ForbiddenError, type Actor } from "../auth/rbac";
import { db, schema } from "../db";
import type { Status } from "../db/schema";
import { fieldErrors, slugify } from "../validation";

/** error carrying an HTTP status and optional per-field messages for forms */
export class ServiceError extends Error {
  constructor(
    message: string,
    public status = 400,
    public fields: Record<string, string> = {},
  ) {
    super(message);
  }
}

export function parse<T extends z.ZodType>(schemaDef: T, input: unknown): z.infer<T> {
  const r = schemaDef.safeParse(input);
  if (!r.success) throw new ServiceError("Please fix the highlighted fields.", 422, fieldErrors(r.error));
  return r.data;
}

/** "my-title", "my-title-2", … unique within the table */
export async function uniqueSlug(
  table: PgTable & { slug: PgColumn; id: PgColumn },
  wanted: string,
  fallback: string,
  excludeId?: string,
) {
  const base = slugify(wanted || fallback) || "untitled";
  for (let i = 1; i < 200; i++) {
    const candidate = i === 1 ? base : `${base}-${i}`;
    const clash = await db
      .select({ id: table.id })
      .from(table)
      .where(excludeId ? and(eq(table.slug, candidate), ne(table.id, excludeId)) : eq(table.slug, candidate))
      .limit(1);
    if (!clash.length) return candidate;
  }
  throw new ServiceError("Could not find a free slug — try another title.");
}

/**
 * Content workflow rules on top of RBAC:
 * - authors may never publish, and may only edit their own unpublished items
 * - editors/admins may do anything
 */
export function checkContentWrite(user: Actor, existing: { authorId: string | null; status: Status } | null, nextStatus: Status) {
  if (existing && !can(user, "update", "content", existing.authorId)) throw new ForbiddenError();
  if (!existing && !can(user, "create", "content")) throw new ForbiddenError();
  if (user.role === "author") {
    if (existing?.status === "published") throw new ForbiddenError("Published items can only be changed by an editor.");
    if (nextStatus === "published") throw new ForbiddenError("Authors can save drafts; an editor publishes them.");
  }
}

/** keep old URLs working after a slug change (and collapse redirect chains) */
export async function recordSlugChange(prefix: string, oldSlug: string, newSlug: string) {
  if (oldSlug === newSlug) return;
  const from = `${prefix}/${oldSlug}`;
  const to = `${prefix}/${newSlug}`;
  const { redirects } = schema;
  await db.delete(redirects).where(or(eq(redirects.fromPath, to), eq(redirects.fromPath, from)));
  await db.update(redirects).set({ toPath: to }).where(eq(redirects.toPath, from));
  await db.insert(redirects).values({ fromPath: from, toPath: to });
}

/** run a service call and convert failures to a form-friendly result */
export type ActionResult<T = unknown> =
  | { ok: true; data?: T; message?: string }
  | { ok: false; error: string; fields?: Record<string, string> };

export async function toResult<T>(fn: () => Promise<T>, message?: string): Promise<ActionResult<T>> {
  try {
    return { ok: true, data: await fn(), message };
  } catch (e) {
    if (e instanceof ServiceError) return { ok: false, error: e.message, fields: e.fields };
    if (e instanceof ForbiddenError) return { ok: false, error: e.message };
    const status = (e as { status?: number }).status;
    if (status === 401) return { ok: false, error: "Your session has expired — please sign in again." };
    // re-throw Next.js control-flow errors (redirect / notFound)
    if ((e as { digest?: string }).digest) throw e;
    console.error("[cms]", e);
    return { ok: false, error: "Something went wrong. Please try again." };
  }
}
