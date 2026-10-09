/**
 * Checks (and if needed repairs) the local database file before the site starts.
 * Runs automatically before `npm run dev`, `npm start`, `npm run build` and the
 * db:* scripts; REPAIR-DATABASE.bat / `npm run db:repair` run it by hand.
 *
 *  1. .data/db.tar.gz opens fine            → nothing to do
 *  2. old folder format (.data/pglite)      → converted to .data/db.tar.gz
 *                                             (the folder is kept as pglite-old-<date>)
 *  3. anything unreadable                   → moved aside (never deleted) and the
 *                                             newest working backup is restored
 *                                             (.data/backups, then the build snapshot)
 *  4. nothing at all                        → a new install: the seed creates it
 *
 * Plain JavaScript on purpose (no TypeScript loader), so it runs anywhere.
 * See lib/cms/db/client.ts for how the file is saved.
 */
import { closeSync, existsSync, fsyncSync, openSync, readdirSync, readFileSync, renameSync, statSync, writeSync } from "node:fs";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";

const DATA = path.join(process.cwd(), ".data");
const DB_FILE = process.env.PGLITE_FILE ?? path.join(DATA, "db.tar.gz");
const LEGACY = path.join(DATA, "pglite");
const BACKUPS = path.join(DATA, "backups");
const SNAPSHOT = path.join(DATA, "pglite-snapshot.tar.gz");
const LOCK = path.join(DATA, "db.lock");
const stamp = () => new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
const log = (m) => console.log(`[db] ${m}`);

function writeAtomic(file, data) {
  const fd = openSync(`${file}.tmp`, "w");
  try {
    writeSync(fd, data);
    fsyncSync(fd);
  } finally {
    closeSync(fd);
  }
  renameSync(`${file}.tmp`, file);
}

/** opens a database (file image or legacy folder), returns its image if it works */
async function check(source) {
  const db = typeof source === "string" ? new PGlite(source) : new PGlite({ loadDataDir: new Blob([source]) });
  try {
    const u = await db.query("select count(*)::int as n from users");
    const p = await db.query("select count(*)::int as n from projects");
    const image = Buffer.from(await (await db.dumpDataDir("gzip")).arrayBuffer());
    return { image, info: `${u.rows[0].n} user(s), ${p.rows[0].n} project(s)` };
  } catch {
    return null;
  } finally {
    await db.close().catch(() => {});
  }
}

async function restoreNewestBackup() {
  const candidates = [
    ...(existsSync(BACKUPS) ? readdirSync(BACKUPS).filter((f) => f.endsWith(".tar.gz")).map((f) => path.join(BACKUPS, f)) : []),
    ...(existsSync(SNAPSHOT) ? [SNAPSHOT] : []),
  ].sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs);
  for (const file of candidates) {
    const ok = await check(readFileSync(file));
    if (ok) {
      writeAtomic(DB_FILE, ok.image);
      log(`restored the backup ${path.basename(file)} (${ok.info})`);
      return true;
    }
    log(`skipped ${path.basename(file)} (unreadable)`);
  }
  log("no working backup found — a fresh database will be created with the original projects.");
  return false;
}

async function main() {
  if (process.env.DATABASE_URL) return; // hosted database: nothing local to check

  if (existsSync(LOCK)) {
    const pid = Number(readFileSync(LOCK, "utf8"));
    let running = false;
    try {
      process.kill(pid, 0);
      running = true;
    } catch (e) {
      running = e.code === "EPERM";
    }
    if (pid && running) {
      console.error(`\n[db] The website is already running in another window (process ${pid}).`);
      console.error("[db] Close that START-WEBSITE window first, then try again.\n");
      process.exit(1);
    }
  }

  if (existsSync(DB_FILE)) {
    if (await check(readFileSync(DB_FILE))) return; // healthy
    const aside = path.join(DATA, `db-broken-${stamp()}.tar.gz`);
    renameSync(DB_FILE, aside);
    log(`the database file could not be read — kept it as ${path.basename(aside)}`);
    await restoreNewestBackup();
    return;
  }

  if (existsSync(LEGACY)) {
    log("converting the database to the new crash-safe format (one time)…");
    const lock = path.join(LEGACY, "postmaster.pid");
    if (existsSync(lock)) renameSync(lock, `${lock}.old`); // stale lock from a killed process
    const ok = await check(LEGACY);
    const aside = path.join(DATA, `${ok ? "pglite-old" : "pglite-broken"}-${stamp()}`);
    renameSync(LEGACY, aside);
    if (ok) {
      writeAtomic(DB_FILE, ok.image);
      log(`done (${ok.info}). The old folder is kept as ${path.basename(aside)}.`);
    } else {
      log(`the old database folder could not be read — kept it as ${path.basename(aside)}`);
      await restoreNewestBackup();
    }
  }
}

main().catch((e) => {
  console.error("[db]", e?.message ?? e);
  process.exit(1);
});
