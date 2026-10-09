import "server-only";
import { mkdir, readFile, stat, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

/**
 * Media storage driver. The default writes to ./storage/uploads on the
 * server's disk and serves files through app/uploads/[file]/route.ts.
 *
 * This works on any long-running Node host (VPS, Railway, Render, Fly, Docker
 * with a volume). On serverless platforms (e.g. Vercel) the disk is
 * read-only/ephemeral — implement the same three functions against S3,
 * Cloudflare R2 or Vercel Blob and return their public URLs instead.
 */
export const UPLOAD_DIR = process.env.UPLOAD_DIR ? path.resolve(/*turbopackIgnore: true*/ process.env.UPLOAD_DIR) : path.join(process.cwd(), "storage", "uploads");
export const UPLOAD_URL_PREFIX = "/uploads/";

export async function putFile(name: string, data: Buffer) {
  await mkdir(/*turbopackIgnore: true*/ UPLOAD_DIR, { recursive: true });
  await writeFile(path.join(/*turbopackIgnore: true*/ UPLOAD_DIR, name), data);
  return UPLOAD_URL_PREFIX + name;
}

export async function getFile(name: string) {
  const file = safeJoin(name);
  if (!file) return null;
  try {
    const [data, info] = await Promise.all([readFile(/*turbopackIgnore: true*/ file), stat(/*turbopackIgnore: true*/ file)]);
    return { data, size: info.size };
  } catch {
    return null;
  }
}

export async function removeFileByUrl(url: string) {
  if (!url.startsWith(UPLOAD_URL_PREFIX)) return; // seeded /public assets are left alone
  const file = safeJoin(url.slice(UPLOAD_URL_PREFIX.length));
  if (file) await unlink(/*turbopackIgnore: true*/ file).catch(() => {});
}

/** prevents path traversal ("../../etc/passwd") */
function safeJoin(name: string) {
  if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]*$/.test(name)) return null;
  const full = path.join(/*turbopackIgnore: true*/ UPLOAD_DIR, name);
  return full.startsWith(UPLOAD_DIR + path.sep) ? full : null;
}
