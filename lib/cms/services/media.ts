import "server-only";
import { randomUUID } from "node:crypto";
import { desc, eq, ilike, or, sql } from "drizzle-orm";
import sharp from "sharp";
import { assertCan, type Actor } from "../auth/rbac";
import { db, schema } from "../db";
import { putFile, removeFileByUrl } from "../storage";
import { imageTone } from "../tone";
import { ServiceError } from "./common";

const { media, projects, posts } = schema;

const MAX_IMAGE = 20 * 1024 * 1024;
const MAX_VIDEO = 80 * 1024 * 1024;
const MAX_AUDIO = 30 * 1024 * 1024;
const IMAGE_FORMATS = new Set(["jpeg", "png", "webp", "avif", "gif", "tiff"]);

/**
 * Upload pipeline
 *  images → validated by actually decoding them (sharp), EXIF-rotated,
 *           capped at 2560px, re-encoded as WebP, plus a 480px "sm" preview
 *           used by the 3D carousel's progressive loading. SVG is rejected
 *           (it can carry scripts).
 *  videos → MP4/WebM only, checked by file signature, stored as-is.
 *  audio  → MP3, M4A/AAC, OGG or WAV (background music), checked by file
 *           signature, stored as-is.
 */
export async function uploadMedia(user: Actor, file: File, alt = "") {
  assertCan(user, "create", "media");
  const buf = Buffer.from(await file.arrayBuffer());
  const id = randomUUID();
  const base = (file.name || "file").replace(/\.[^.]+$/, "").slice(0, 80);

  const audio = sniffAudio(buf);
  if (audio) {
    if (buf.length > MAX_AUDIO) throw new ServiceError("Audio must be under 30 MB.", 413);
    const url = await putFile(`${id}.${audio.ext}`, buf);
    const [row] = await db
      .insert(media)
      .values({ url, filename: base + "." + audio.ext, mimeType: audio.mime, size: buf.length, alt, uploadedBy: user.id })
      .returning();
    return row;
  }

  const video = sniffVideo(buf);
  if (video) {
    if (buf.length > MAX_VIDEO) throw new ServiceError("Videos must be under 80 MB.", 413);
    const url = await putFile(`${id}.${video.ext}`, buf);
    const [row] = await db
      .insert(media)
      .values({ url, filename: base + "." + video.ext, mimeType: video.mime, size: buf.length, alt, uploadedBy: user.id })
      .returning();
    return row;
  }

  if (buf.length > MAX_IMAGE) throw new ServiceError("Images must be under 20 MB.", 413);
  let meta: Awaited<ReturnType<ReturnType<typeof sharp>["metadata"]>>;
  try {
    meta = await sharp(buf).metadata();
  } catch {
    throw new ServiceError("Unsupported file. Upload JPG, PNG, WebP, AVIF, GIF, MP4, WebM, MP3, M4A, OGG or WAV.", 415);
  }
  if (!meta.format || !IMAGE_FORMATS.has(meta.format)) throw new ServiceError(`Unsupported image format (${meta.format ?? "unknown"}).`, 415);

  const animated = (meta.pages ?? 1) > 1;
  const pipeline = () => sharp(buf, { animated }).rotate();
  const main = await pipeline()
    .resize({ width: 2560, height: 2560, fit: "inside", withoutEnlargement: true })
    .webp({ quality: 82 })
    .toBuffer({ resolveWithObject: true });
  const small = await pipeline().resize({ width: 480, withoutEnlargement: true }).webp({ quality: 68 }).toBuffer();

  const url = await putFile(`${id}.webp`, main.data);
  const sm = await putFile(`${id}-sm.webp`, small);
  const tone = await imageTone(small).catch(() => undefined); // brightness map for readable text over the image
  const [row] = await db
    .insert(media)
    .values({
      url,
      filename: `${base}.webp`,
      mimeType: "image/webp",
      size: main.data.length,
      width: main.info.width,
      height: animated ? Math.round(main.info.height / (meta.pages ?? 1)) : main.info.height,
      alt,
      variants: { sm, tone },
      uploadedBy: user.id,
    })
    .returning();
  return row;
}

/** ISO media brand ("isom", "M4A ", "avif"…) of an MP4-family file, or null */
const ftypBrand = (b: Buffer) => (b.length > 12 && b.toString("ascii", 4, 8) === "ftyp" ? b.toString("ascii", 8, 12) : null);

function sniffAudio(b: Buffer) {
  const brand = ftypBrand(b);
  if (brand === "M4A " || brand === "M4B ") return { ext: "m4a", mime: "audio/mp4" };
  if (b.length > 3 && b.toString("ascii", 0, 3) === "ID3") return { ext: "mp3", mime: "audio/mpeg" };
  // a bare MPEG audio frame: 11 sync bits, layer III
  if (b.length > 2 && b[0] === 0xff && (b[1] & 0xe0) === 0xe0 && (b[1] & 0x06) === 0x02) return { ext: "mp3", mime: "audio/mpeg" };
  if (b.length > 4 && b.toString("ascii", 0, 4) === "OggS") return { ext: "ogg", mime: "audio/ogg" };
  if (b.length > 12 && b.toString("ascii", 0, 4) === "RIFF" && b.toString("ascii", 8, 12) === "WAVE") return { ext: "wav", mime: "audio/wav" };
  return null;
}

function sniffVideo(b: Buffer) {
  const brand = ftypBrand(b);
  // AVIF/HEIF images share the MP4 container — those go to the image pipeline
  if (brand && !/^(avi[fs]|hei[cfx]|mif1|msf1)$/.test(brand)) return { ext: "mp4", mime: "video/mp4" };
  if (b.length > 4 && b.readUInt32BE(0) === 0x1a45dfa3) return { ext: "webm", mime: "video/webm" };
  return null;
}

export async function listMedia(q = "", limit = 200) {
  return db
    .select()
    .from(media)
    .where(q ? or(ilike(media.filename, `%${q}%`), ilike(media.alt, `%${q}%`)) : undefined)
    .orderBy(desc(media.createdAt))
    .limit(limit);
}

export async function updateMediaAlt(user: Actor, id: string, alt: string) {
  assertCan(user, "update", "media");
  await db.update(media).set({ alt: alt.trim().slice(0, 300) }).where(eq(media.id, id));
}

/** how many content items reference a media file (cover/hero or section URL) */
export async function mediaUsage(id: string, url: string) {
  const [p, q] = await Promise.all([
    db
      .select({ title: projects.title })
      .from(projects)
      .where(
        or(
          eq(projects.coverId, id),
          eq(projects.heroId, id),
          eq(projects.videoUrl, url),
          sql`${projects.sections}::text like ${"%" + url + "%"}`,
        ),
      ),
    db.select({ title: posts.title }).from(posts).where(or(eq(posts.coverId, id), sql`${posts.body} like ${"%" + url + "%"}`)),
  ]);
  return [...p, ...q].map((r) => r.title);
}

export async function deleteMedia(user: Actor, id: string, force = false) {
  assertCan(user, "delete", "media");
  const row = (await db.select().from(media).where(eq(media.id, id)))[0];
  if (!row) return;
  const used = await mediaUsage(id, row.url);
  if (used.length && !force) throw new ServiceError(`Still used by: ${used.slice(0, 3).join(", ")}${used.length > 3 ? "…" : ""}`, 409);
  await db.delete(media).where(eq(media.id, id));
  await removeFileByUrl(row.url);
  if (row.variants.sm) await removeFileByUrl(row.variants.sm);
}
