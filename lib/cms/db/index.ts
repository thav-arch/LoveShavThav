import "server-only";
import { readdirSync } from "node:fs";
import path from "node:path";
import { createDb, runMigrations, type Db } from "./client";

export type { Db };
export { schema } from "./client";

// one client per server process, reused across hot reloads in development
const g = globalThis as unknown as { __cmsDb?: Db; __cmsMigrations?: string };
export const db: Db = g.__cmsDb ?? (g.__cmsDb = createDb({ server: true }).db);

// Local database: apply any new migrations as soon as this module (re)loads —
// on start, and in development also right after an update hot-reloads, so a
// new column never breaks a running site. Hosted databases migrate in prebuild.
if (!process.env.DATABASE_URL && process.env.NEXT_PHASE !== "phase-production-build") {
  // changes whenever a migration file is added
  const key = readdirSync(/*turbopackIgnore: true*/ path.join(process.cwd(), "drizzle"))
    .filter((f) => f.endsWith(".sql"))
    .join(",");
  if (g.__cmsMigrations !== key) {
    g.__cmsMigrations = key;
    runMigrations({ db, kind: "pglite", close: async () => {} }).catch((e) => console.error("[db] migration failed", e?.message ?? e));
  }
}
