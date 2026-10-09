import { closeSync, copyFileSync, existsSync, fsyncSync, mkdirSync, openSync, readdirSync, readFileSync, renameSync, unlinkSync, writeSync } from "node:fs";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { drizzle as drizzlePglite } from "drizzle-orm/pglite";
import { migrate as migratePglite } from "drizzle-orm/pglite/migrator";
import { drizzle as drizzlePg, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { migrate as migratePg } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";
import * as schema from "./schema";

/**
 * Database client.
 *
 * - DATABASE_URL set   → hosted PostgreSQL via node-postgres (production).
 * - DATABASE_URL unset → PGlite: real Postgres compiled to WASM. Zero install.
 *
 * Local storage is crash-safe by design: PGlite runs IN MEMORY and the whole
 * database is saved to one file, .data/db.tar.gz, shortly after every change
 * (and on shutdown). Each save writes a temporary file and then swaps it in,
 * so the file on disk is always a complete, consistent database — closing the
 * window, a crash or a power cut can lose at most the last ~2 seconds, never
 * corrupt it. (PGlite's own on-disk folder mode can be left unreadable when
 * the process is killed mid-write; that's what this replaces.)
 *
 * Extra safety:
 *  - a lock file stops a second copy of the site (or a CLI script) from using
 *    the same database at the same time; Next.js's own worker processes get a
 *    read-only copy instead;
 *  - a backup copy is kept in .data/backups on every start (newest 10).
 *
 * `next build` runs several worker processes: each loads a private read-only
 * copy of .data/pglite-snapshot.tar.gz (written by scripts/db-snapshot.ts).
 *
 * Both drivers expose the same Drizzle API, so the rest of the CMS doesn't care.
 */
export type Db = NodePgDatabase<typeof schema>;

type Handle = { db: Db; kind: "pg" | "pglite"; client?: PGlite; close: () => Promise<void> };

const DATA = path.join(process.cwd(), ".data");
export const DB_FILE = process.env.PGLITE_FILE ?? path.join(DATA, "db.tar.gz");
/** the old folder format; scripts/db-file.mjs converts it to DB_FILE */
export const PGLITE_LEGACY_DIR = path.join(DATA, "pglite");
export const PGLITE_SNAPSHOT = path.join(DATA, "pglite-snapshot.tar.gz");
export const PGLITE_BACKUPS = path.join(DATA, "backups");
const LOCK_FILE = path.join(DATA, "db.lock");
const KEEP_BACKUPS = 10;
const AUTOSAVE_MS = 1500;

export function createDb(opts: { server?: boolean } = {}): Handle {
  const url = process.env.DATABASE_URL;
  if (url) {
    const pool = new Pool({ connectionString: url, max: Number(process.env.DATABASE_POOL_MAX ?? 10) });
    return { db: drizzlePg(pool, { schema }), kind: "pg", close: () => pool.end() };
  }

  if (process.env.NEXT_PHASE === "phase-production-build") {
    // build workers run in parallel: each gets a private in-memory copy
    if (!existsSync(/*turbopackIgnore: true*/ PGLITE_SNAPSHOT))
      throw new Error("PGlite snapshot missing — build with `npm run build` (it runs the snapshot step first).");
    const client = new PGlite({ loadDataDir: new Blob([readFileSync(/*turbopackIgnore: true*/ PGLITE_SNAPSHOT)]) });
    return { db: drizzlePglite(client, { schema }) as unknown as Db, kind: "pglite", client, close: () => client.close() };
  }

  // Next.js runs some work (e.g. generateStaticParams in dev) in short-lived
  // worker processes. They must never own or save the database — the main
  // server does — so they read a private copy of the last saved file.
  // (Two processes opening the same database is what used to corrupt it.)
  if (isHelperProcess()) {
    const image = existsSync(/*turbopackIgnore: true*/ DB_FILE) ? readFileSync(/*turbopackIgnore: true*/ DB_FILE) : null;
    const client = new PGlite(image ? { loadDataDir: new Blob([image]) } : undefined);
    return { db: drizzlePglite(client, { schema }) as unknown as Db, kind: "pglite", client, close: () => client.close() };
  }

  return openFileDb(opts.server ?? false);
}

/* ------------------------------------------------------- local file storage */

function openFileDb(server: boolean): Handle {
  mkdirSync(/*turbopackIgnore: true*/ DATA, { recursive: true });
  if (!existsSync(/*turbopackIgnore: true*/ DB_FILE) && existsSync(/*turbopackIgnore: true*/ PGLITE_LEGACY_DIR))
    throw new Error("The database is in the old folder format. Start the site with START-WEBSITE (or `npm run dev`) — it converts it automatically.");
  acquireLock();

  const image = existsSync(/*turbopackIgnore: true*/ DB_FILE) ? readFileSync(/*turbopackIgnore: true*/ DB_FILE) : null;
  const client = new PGlite(image ? { loadDataDir: new Blob([image]) } : undefined);

  let savedLsn = "";
  let saving: Promise<void> | null = null;
  const lsn = async () => (await client.query<{ l: string }>("select pg_current_wal_lsn()::text as l")).rows[0].l;
  /** write the whole database to DB_FILE if anything changed since the last save */
  const save = (force = false) =>
    (saving ??= (async () => {
      try {
        const now = await lsn();
        if (!force && now === savedLsn) return;
        const dump = await client.dumpDataDir("gzip");
        writeAtomic(DB_FILE, Buffer.from(await dump.arrayBuffer()));
        savedLsn = now;
      } finally {
        saving = null;
      }
    })());

  const db = drizzlePglite(client, { schema }) as unknown as Db;
  client.waitReady
    .then(async () => {
      savedLsn = image ? await lsn() : ""; // a brand-new database is saved on its first check
      if (server && image) backup(); // the file as it was, before any migration (lib/cms/db/index.ts)
    })
    .catch((e) => console.error("[db] could not load or upgrade the database — run REPAIR-DATABASE.bat", e?.message ?? e));

  let closed = false;
  const close = async () => {
    if (closed) return;
    closed = true;
    await save().catch((e) => console.error("[db] final save failed", e));
    await client.close().catch(() => {});
    releaseLock();
  };

  if (server) {
    const timer = setInterval(() => void save().catch((e) => console.error("[db] autosave failed", e?.message ?? e)), AUTOSAVE_MS);
    timer.unref?.();
    // Ctrl+C, closing the console window (SIGHUP on Windows), stop signals: save first
    const stop = () => {
      clearInterval(timer);
      void close().finally(() => process.exit(0));
    };
    for (const s of ["SIGINT", "SIGTERM", "SIGHUP", "SIGBREAK"] as const) process.once(s, stop);
  }

  return { db, kind: "pglite", client, close };
}

/** write to a temp file, flush it to disk, then swap it in — never a half-written DB_FILE */
function writeAtomic(file: string, data: Buffer) {
  const tmp = `${file}.tmp`;
  const fd = openSync(/*turbopackIgnore: true*/ tmp, "w");
  try {
    writeSync(fd, data);
    fsyncSync(fd);
  } finally {
    closeSync(fd);
  }
  renameSync(/*turbopackIgnore: true*/ tmp, /*turbopackIgnore: true*/ file);
}

function backup() {
  mkdirSync(/*turbopackIgnore: true*/ PGLITE_BACKUPS, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  copyFileSync(/*turbopackIgnore: true*/ DB_FILE, path.join(/*turbopackIgnore: true*/ PGLITE_BACKUPS, `db-${stamp}.tar.gz`));
  const old = readdirSync(/*turbopackIgnore: true*/ PGLITE_BACKUPS)
    .filter((f) => f.endsWith(".tar.gz"))
    .sort((a, b) => a.slice(a.indexOf("-")).localeCompare(b.slice(b.indexOf("-")))) // by timestamp, any prefix
    .slice(0, -KEEP_BACKUPS);
  for (const f of old) unlinkSync(path.join(/*turbopackIgnore: true*/ PGLITE_BACKUPS, f));
}

/* ------------------------------------------------------------------ lock */

const lockOwner = () => {
  try {
    return Number(readFileSync(/*turbopackIgnore: true*/ LOCK_FILE, "utf8")) || 0;
  } catch {
    return 0;
  }
};

/** a Next.js worker spawned by the server that owns the database (e.g. generateStaticParams in dev) */
function isHelperProcess() {
  if (process.env.IS_NEXT_WORKER === "true" || process.env.JEST_WORKER_ID) return true;
  if (/[\\/]jest-worker[\\/]/.test(process.argv[1] ?? "")) return true;
  const owner = lockOwner();
  return owner !== 0 && owner === process.ppid && alive(owner);
}

const alive = (pid: number) => {
  try {
    process.kill(pid, 0);
    return true;
  } catch (e) {
    return (e as NodeJS.ErrnoException).code === "EPERM"; // exists, owned by someone else
  }
};

function acquireLock() {
  {
    const pid = lockOwner();
    if (pid && pid !== process.pid && alive(pid))
      throw new Error(
        `The website's database is already open in another window (process ${pid}). ` +
          "Close the other START-WEBSITE window (or stop that npm command) first — two copies on one database would overwrite each other.",
      );
  }
  writeAtomic(LOCK_FILE, Buffer.from(String(process.pid)));
  process.once("exit", releaseLock);
}

function releaseLock() {
  try {
    if (Number(readFileSync(/*turbopackIgnore: true*/ LOCK_FILE, "utf8")) === process.pid) unlinkSync(/*turbopackIgnore: true*/ LOCK_FILE);
  } catch {}
}

export async function runMigrations(h: Handle) {
  const config = { migrationsFolder: "./drizzle" };
  // the two drivers have different nominal types but identical behaviour
  if (h.kind === "pg") await migratePg(h.db, config);
  else await migratePglite(h.db as unknown as Parameters<typeof migratePglite>[0], config);
}

export { schema };
