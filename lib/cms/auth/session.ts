import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { and, eq, gt, lt } from "drizzle-orm";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { db, schema } from "../db";
import { assertCan, type Action, type Resource } from "./rbac";

/**
 * Database sessions. The browser holds a random 256-bit token in an
 * httpOnly, SameSite=Lax cookie; the database stores only its SHA-256, so a
 * leaked database can't be used to hijack sessions. Logging out (or deleting
 * a user) revokes access immediately — unlike stateless JWTs.
 */
export const SESSION_COOKIE = "cms_session";
const TTL_DAYS = 30;

const hash = (token: string) => createHash("sha256").update(token).digest("hex");

export type SessionUser = Pick<typeof schema.users.$inferSelect, "id" | "email" | "name" | "role">;

export async function createSession(userId: string) {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + TTL_DAYS * 864e5);
  const ua = (await headers()).get("user-agent")?.slice(0, 300) ?? null;
  await db.insert(schema.sessions).values({ id: hash(token), userId, expiresAt, userAgent: ua });
  // opportunistic cleanup of expired sessions
  await db.delete(schema.sessions).where(lt(schema.sessions.expiresAt, new Date()));
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  });
}

export async function destroySession() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) await db.delete(schema.sessions).where(eq(schema.sessions.id, hash(token)));
  jar.delete(SESSION_COOKIE);
}

/** current user for this request (memoised per request) */
export const getCurrentUser = cache(async (): Promise<SessionUser | null> => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const rows = await db
    .select({ id: schema.users.id, email: schema.users.email, name: schema.users.name, role: schema.users.role })
    .from(schema.sessions)
    .innerJoin(schema.users, eq(schema.users.id, schema.sessions.userId))
    .where(and(eq(schema.sessions.id, hash(token)), gt(schema.sessions.expiresAt, new Date())))
    .limit(1);
  return rows[0] ?? null;
});

/** for admin pages: redirects to the login screen when signed out */
export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) redirect("/admin/login");
  return user;
}

/** for actions / API routes: throws 401/403 instead of redirecting */
export async function requirePermission(action: Action, resource: Resource, ownerId?: string | null) {
  const user = await getCurrentUser();
  if (!user) throw Object.assign(new Error("Please sign in."), { status: 401 });
  assertCan(user, action, resource, ownerId);
  return user;
}

export async function revokeUserSessions(userId: string) {
  await db.delete(schema.sessions).where(eq(schema.sessions.userId, userId));
}
