/**
 * Applies pending SQL migrations from ./drizzle.
 *   npm run db:migrate
 * Uses DATABASE_URL when set, otherwise the local PGlite database.
 */
import { createDb, runMigrations } from "../lib/cms/db/client";

async function main() {
  const h = createDb();
  console.log(`[db] migrating (${h.kind})…`);
  await runMigrations(h);
  await h.close();
  console.log("[db] up to date");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
