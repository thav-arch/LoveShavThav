/**
 * Runs automatically before every `npm run build`.
 *
 * - Hosted Postgres (DATABASE_URL set): applies migrations, and when
 *   ADMIN_EMAIL / ADMIN_PASSWORD are set, seeds an empty database (first
 *   admin + your projects). Safe on every deploy: nothing is duplicated.
 * - Local PGlite: applies migrations, then writes a compressed copy of the
 *   database that each build worker loads into memory (lib/cms/db/client.ts).
 */
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { createDb, PGLITE_SNAPSHOT, runMigrations } from "../lib/cms/db/client";
import { seed } from "./seed";

async function main() {
  const h = createDb();
  if (h.kind === "pg") {
    if (process.env.ADMIN_EMAIL && process.env.ADMIN_PASSWORD) await seed(h);
    else await runMigrations(h);
    console.log("[db] hosted database ready");
  } else if (h.client) {
    await runMigrations(h);
    const blob = await h.client.dumpDataDir("gzip");
    mkdirSync(path.dirname(PGLITE_SNAPSHOT), { recursive: true });
    writeFileSync(PGLITE_SNAPSHOT, Buffer.from(await blob.arrayBuffer()));
    console.log(`[db] snapshot for build → ${path.relative(process.cwd(), PGLITE_SNAPSHOT)}`);
  }
  await h.close();
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  console.error("If the database is locked, stop the website (close START-WEBSITE / npm run dev) before building.");
  process.exit(1);
});
