"use server";

import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { verifyPassword } from "@/lib/cms/auth/password";
import { rateLimit } from "@/lib/cms/auth/rate-limit";
import { createSession, destroySession, getCurrentUser } from "@/lib/cms/auth/session";
import { isCollection, type CollectionKey } from "@/lib/cms/collections";
import { db, schema } from "@/lib/cms/db";
import type { Role, Status } from "@/lib/cms/db/schema";
import { invalidateFromAction } from "@/lib/cms/revalidate";
import type { SettingsKey } from "@/lib/cms/settings-schema";
import { ServiceError, toResult, type ActionResult } from "@/lib/cms/services/common";
import { deleteEntry, moveEntry, saveEntry } from "@/lib/cms/services/entries";
import { deleteMedia, listMedia, updateMediaAlt } from "@/lib/cms/services/media";
import { deletePost, savePost } from "@/lib/cms/services/posts";
import { deleteProject, moveProject, saveProject, setProjectStatus } from "@/lib/cms/services/projects";
import { saveSettings } from "@/lib/cms/services/settings";
import { deleteCategory, deleteTag, renameTag, saveCategory } from "@/lib/cms/services/taxonomy";
import { changeOwnPassword, createUser, deleteUser, resetUserPassword, setUserRole } from "@/lib/cms/services/users";

/**
 * Dashboard Server Actions. Every action re-checks the session (actions are
 * public HTTP endpoints) and delegates to the service layer, which enforces
 * validation and role permissions. Next.js verifies the Origin header on
 * actions, which protects them from CSRF.
 */
async function actor() {
  const user = await getCurrentUser();
  if (!user) throw Object.assign(new Error("Please sign in."), { status: 401 });
  return user;
}

/* -------------------------------------------------------------- auth */

const DUMMY_HASH = "scrypt$16384$8$1$AAAAAAAAAAAAAAAAAAAAAA==$" + "A".repeat(86) + "==";

export async function loginAction(_prev: { error?: string } | undefined, form: FormData) {
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const password = String(form.get("password") ?? "");
  const ip = (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  const limit = rateLimit(`login:${ip}:${email}`, 8, 15 * 60_000);
  if (!limit.ok) return { error: `Too many attempts. Try again in ${Math.ceil(limit.retryAfter / 60)} min.` };

  const user = (await db.select().from(schema.users).where(eq(schema.users.email, email)).limit(1))[0];
  // always run the hash check so response time doesn't reveal which emails exist
  const valid = await verifyPassword(password, user?.passwordHash ?? DUMMY_HASH);
  if (!user || !valid) return { error: "Email or password is incorrect." };

  await db.update(schema.users).set({ lastLoginAt: new Date() }).where(eq(schema.users.id, user.id));
  await createSession(user.id);
  const next = String(form.get("next") ?? "");
  redirect(next.startsWith("/admin") ? next : "/admin");
}

export async function logoutAction() {
  await destroySession();
  redirect("/admin/login");
}

/* ----------------------------------------------------------- projects */

export async function saveProjectAction(id: string | null, input: unknown): Promise<ActionResult<{ id: string; slug: string }>> {
  const r = await toResult(async () => saveProject(await actor(), id, input), "Saved");
  if (r.ok) invalidateFromAction("projects", "taxonomy", "redirects");
  return r;
}

export async function deleteProjectAction(id: string): Promise<ActionResult> {
  const r = await toResult(async () => deleteProject(await actor(), id), "Deleted");
  if (r.ok) invalidateFromAction("projects");
  return r;
}

export async function setProjectStatusAction(id: string, status: Status) {
  const r = await toResult(async () => setProjectStatus(await actor(), id, status));
  if (r.ok) invalidateFromAction("projects");
}

export async function moveProjectAction(id: string, dir: -1 | 1) {
  const r = await toResult(async () => moveProject(await actor(), id, dir));
  if (r.ok) invalidateFromAction("projects");
}

/* -------------------------------------------------------------- posts */

export async function savePostAction(id: string | null, input: unknown): Promise<ActionResult<{ id: string; slug: string }>> {
  const r = await toResult(async () => savePost(await actor(), id, input), "Saved");
  if (r.ok) invalidateFromAction("posts", "taxonomy", "redirects");
  return r;
}

export async function deletePostAction(id: string): Promise<ActionResult> {
  const r = await toResult(async () => deletePost(await actor(), id), "Deleted");
  if (r.ok) invalidateFromAction("posts");
  return r;
}

/* ----------------------------------------------------- modular entries */

function collectionOrThrow(c: string): CollectionKey {
  if (!isCollection(c)) throw new ServiceError("Unknown collection.", 404);
  return c;
}

export async function saveEntryAction(collection: string, id: string | null, input: Record<string, unknown>): Promise<ActionResult<{ id: string }>> {
  const r = await toResult(async () => saveEntry(await actor(), collectionOrThrow(collection), id, input), "Saved");
  if (r.ok) invalidateFromAction("entries");
  return r;
}

export async function deleteEntryAction(collection: string, id: string): Promise<ActionResult> {
  const r = await toResult(async () => deleteEntry(await actor(), collectionOrThrow(collection), id), "Deleted");
  if (r.ok) invalidateFromAction("entries");
  return r;
}

export async function moveEntryAction(collection: string, id: string, dir: -1 | 1) {
  const r = await toResult(async () => moveEntry(await actor(), collectionOrThrow(collection), id, dir));
  if (r.ok) invalidateFromAction("entries");
}

/* -------------------------------------------------------------- media */

export async function listMediaAction(q = "") {
  await actor();
  const rows = await listMedia(q);
  return rows.map((m) => ({ ...m, createdAt: m.createdAt.toISOString() }));
}

export async function updateMediaAltAction(id: string, alt: string): Promise<ActionResult> {
  const r = await toResult(async () => updateMediaAlt(await actor(), id, alt), "Saved");
  if (r.ok) invalidateFromAction("projects", "posts");
  return r;
}

export async function deleteMediaAction(id: string, force = false): Promise<ActionResult> {
  const r = await toResult(async () => deleteMedia(await actor(), id, force), "Deleted");
  if (r.ok) invalidateFromAction("projects", "posts");
  return r;
}

/* ----------------------------------------------------------- taxonomy */

export async function saveCategoryAction(id: string | null, input: unknown): Promise<ActionResult> {
  const r = await toResult(async () => saveCategory(await actor(), id, input), "Saved");
  if (r.ok) invalidateFromAction("taxonomy", "projects", "posts");
  return r;
}

export async function deleteCategoryAction(id: string): Promise<ActionResult> {
  const r = await toResult(async () => deleteCategory(await actor(), id), "Deleted");
  if (r.ok) invalidateFromAction("taxonomy", "projects", "posts");
  return r;
}

export async function renameTagAction(id: string, name: string): Promise<ActionResult> {
  const r = await toResult(async () => renameTag(await actor(), id, { name }), "Saved");
  if (r.ok) invalidateFromAction("taxonomy", "projects", "posts");
  return r;
}

export async function deleteTagAction(id: string): Promise<ActionResult> {
  const r = await toResult(async () => deleteTag(await actor(), id), "Deleted");
  if (r.ok) invalidateFromAction("taxonomy", "projects", "posts");
  return r;
}

/* ----------------------------------------------------------- settings */

export async function saveSettingsAction(key: SettingsKey, input: unknown): Promise<ActionResult> {
  const r = await toResult(async () => saveSettings(await actor(), key, input), "Saved");
  if (r.ok) invalidateFromAction("settings");
  return r;
}

/* -------------------------------------------------------------- users */

export async function createUserAction(input: unknown): Promise<ActionResult> {
  return toResult(async () => createUser(await actor(), input), "User created");
}

export async function setUserRoleAction(id: string, role: Role): Promise<ActionResult> {
  return toResult(async () => setUserRole(await actor(), id, role), "Role updated");
}

export async function resetPasswordAction(id: string, password: string): Promise<ActionResult> {
  return toResult(async () => resetUserPassword(await actor(), id, password), "Password reset — their sessions were signed out");
}

export async function deleteUserAction(id: string): Promise<ActionResult> {
  return toResult(async () => deleteUser(await actor(), id), "User deleted");
}

export async function changePasswordAction(current: string, next: string): Promise<ActionResult> {
  return toResult(async () => changeOwnPassword(await actor(), current, next), "Password changed");
}
