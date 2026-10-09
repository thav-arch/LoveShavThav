import "server-only";
import { and, asc, count, eq, ne } from "drizzle-orm";
import { z } from "zod";
import { hashPassword, PASSWORD_MIN, verifyPassword } from "../auth/password";
import { assertCan, type Actor } from "../auth/rbac";
import { revokeUserSessions } from "../auth/session";
import { db, schema } from "../db";
import type { Role } from "../db/schema";
import { parse, ServiceError } from "./common";

const { users } = schema;
const role = z.enum(["admin", "editor", "author"]);
const password = z.string().min(PASSWORD_MIN, `Use at least ${PASSWORD_MIN} characters`).max(200);

export async function listUsers() {
  return db
    .select({ id: users.id, email: users.email, name: users.name, role: users.role, lastLoginAt: users.lastLoginAt, createdAt: users.createdAt })
    .from(users)
    .orderBy(asc(users.createdAt));
}

export async function createUser(actor: Actor, input: unknown) {
  assertCan(actor, "create", "users");
  const d = parse(z.object({ name: z.string().trim().min(1).max(80), email: z.string().trim().toLowerCase().email(), role, password }), input);
  const clash = await db.select({ id: users.id }).from(users).where(eq(users.email, d.email));
  if (clash.length) throw new ServiceError("A user with that email already exists.", 409, { email: "Already in use" });
  await db.insert(users).values({ name: d.name, email: d.email, role: d.role, passwordHash: await hashPassword(d.password) });
}

/** never allow the last admin to be demoted or removed */
async function assertNotLastAdmin(userId: string) {
  const target = (await db.select({ role: users.role }).from(users).where(eq(users.id, userId)))[0];
  if (target?.role !== "admin") return;
  const [{ n }] = await db.select({ n: count() }).from(users).where(and(eq(users.role, "admin"), ne(users.id, userId)));
  if (Number(n) === 0) throw new ServiceError("There must be at least one admin.");
}

export async function setUserRole(actor: Actor, userId: string, next: Role) {
  assertCan(actor, "update", "users");
  role.parse(next);
  if (next !== "admin") await assertNotLastAdmin(userId);
  await db.update(users).set({ role: next }).where(eq(users.id, userId));
}

export async function resetUserPassword(actor: Actor, userId: string, newPassword: string) {
  assertCan(actor, "update", "users");
  parse(password, newPassword);
  await db.update(users).set({ passwordHash: await hashPassword(newPassword) }).where(eq(users.id, userId));
  await revokeUserSessions(userId);
}

export async function deleteUser(actor: Actor, userId: string) {
  assertCan(actor, "delete", "users");
  if (userId === actor.id) throw new ServiceError("You can't delete your own account.");
  await assertNotLastAdmin(userId);
  await db.delete(users).where(eq(users.id, userId));
}

export async function changeOwnPassword(actor: Actor, current: string, next: string) {
  parse(password, next);
  const row = (await db.select({ hash: users.passwordHash }).from(users).where(eq(users.id, actor.id)))[0];
  if (!row || !(await verifyPassword(current, row.hash))) throw new ServiceError("Current password is incorrect.", 400, { current: "Incorrect" });
  await db.update(users).set({ passwordHash: await hashPassword(next) }).where(eq(users.id, actor.id));
}
