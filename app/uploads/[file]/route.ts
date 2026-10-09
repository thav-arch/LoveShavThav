import { getFile } from "@/lib/cms/storage";

/**
 * Serves uploaded media from ./storage/uploads. Filenames are random UUIDs and
 * never overwritten, so responses can be cached "forever" by browsers/CDNs.
 * (Files added to /public after a build are NOT served by Next.js — hence
 * this route.)
 */
const TYPES: Record<string, string> = {
  webp: "image/webp",
  jpg: "image/jpeg",
  png: "image/png",
  avif: "image/avif",
  gif: "image/gif",
  mp4: "video/mp4",
  webm: "video/webm",
  mp3: "audio/mpeg",
  m4a: "audio/mp4",
  ogg: "audio/ogg",
  wav: "audio/wav",
};

export async function GET(req: Request, ctx: RouteContext<"/uploads/[file]">) {
  const { file } = await ctx.params;
  const found = await getFile(file);
  if (!found) return new Response("Not found", { status: 404 });
  const type = TYPES[file.split(".").pop()!.toLowerCase()] ?? "application/octet-stream";
  const headers = {
    "Content-Type": type,
    "Cache-Control": "public, max-age=31536000, immutable",
    "Accept-Ranges": "bytes",
    "X-Content-Type-Options": "nosniff",
  };

  // byte ranges so videos and music can seek / stream (required by Safari)
  const range = req.headers.get("range");
  const m = range && /bytes=(\d*)-(\d*)/.exec(range);
  if (m) {
    const start = m[1] ? Number(m[1]) : found.size - Number(m[2]);
    const end = m[1] && m[2] ? Math.min(Number(m[2]), found.size - 1) : found.size - 1;
    if (start >= found.size || start > end) return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${found.size}` } });
    return new Response(new Uint8Array(found.data.subarray(start, end + 1)), {
      status: 206,
      headers: { ...headers, "Content-Range": `bytes ${start}-${end}/${found.size}`, "Content-Length": String(end - start + 1) },
    });
  }
  return new Response(new Uint8Array(found.data), { headers: { ...headers, "Content-Length": String(found.size) } });
}
