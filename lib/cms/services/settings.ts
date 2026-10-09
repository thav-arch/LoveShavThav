import "server-only";
import { eq } from "drizzle-orm";
import { assertCan, type Actor } from "../auth/rbac";
import { db, schema } from "../db";
import { settingsDefs, type SettingsKey } from "../settings-schema";
import { parse } from "./common";

/** uncached read for the admin forms */
export async function readSettings<K extends SettingsKey>(key: K) {
  const def = settingsDefs[key];
  const row = (await db.select().from(schema.settings).where(eq(schema.settings.key, key)))[0];
  const parsed = def.schema.safeParse({ ...def.defaults, ...(row?.value ?? {}) });
  return (parsed.success ? parsed.data : def.defaults) as (typeof settingsDefs)[K]["defaults"];
}

export async function saveSettings(user: Actor, key: SettingsKey, input: unknown) {
  assertCan(user, "update", "settings");
  const value = parse(settingsDefs[key].schema, input) as Record<string, unknown>;
  await db
    .insert(schema.settings)
    .values({ key, value })
    .onConflictDoUpdate({ target: schema.settings.key, set: { value, updatedAt: new Date() } });
}
