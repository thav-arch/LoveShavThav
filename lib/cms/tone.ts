import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { getFile, UPLOAD_URL_PREFIX } from "./storage";

/**
 * Image "tone": average brightness (0–1) on a 3×3 grid, row by row. Used to
 * pick readable text over an image (lib/section-design.ts → overlay style
 * and scrim strength). Computed once at upload (stored in media.variants.tone)
 * and, for older files, on demand when a page is cached — a 30×30 downscale,
 * a few milliseconds.
 */
export async function imageTone(input: Buffer): Promise<number[]> {
  const { data, info } = await sharp(input, { animated: false })
    .rotate()
    .resize(30, 30, { fit: "fill" })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const sum = Array(9).fill(0);
  const count = Array(9).fill(0);
  for (let y = 0; y < info.height; y++)
    for (let x = 0; x < info.width; x++) {
      const p = (y * info.width + x) * info.channels;
      const cell = Math.min(2, Math.floor((y * 3) / info.height)) * 3 + Math.min(2, Math.floor((x * 3) / info.width));
      sum[cell] += (0.2126 * data[p] + 0.7152 * data[p + 1] + 0.0722 * data[p + 2]) / 255;
      count[cell]++;
    }
  return sum.map((s, k) => Math.round((s / Math.max(1, count[k])) * 100) / 100);
}

const memo = new Map<string, Promise<number[] | undefined>>();

/** tone of an image by its site URL (uploads or files in /public), memoised */
export function toneForUrl(url: string): Promise<number[] | undefined> {
  let p = memo.get(url);
  if (!p) {
    p = (async () => {
      try {
        let data: Buffer | null = null;
        if (url.startsWith(UPLOAD_URL_PREFIX)) data = (await getFile(url.slice(UPLOAD_URL_PREFIX.length)))?.data ?? null;
        else if (url.startsWith("/") && !url.includes("..")) {
          const pub = path.join(process.cwd(), "public");
          const file = path.join(/*turbopackIgnore: true*/ pub, decodeURIComponent(url.split("?")[0]));
          if (file.startsWith(pub + path.sep)) data = await readFile(/*turbopackIgnore: true*/ file);
        }
        return data ? await imageTone(data) : undefined;
      } catch {
        return undefined;
      }
    })();
    memo.set(url, p);
  }
  return p;
}
