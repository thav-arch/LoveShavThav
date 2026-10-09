import { getPublishedPosts, getSettings } from "@/lib/cms/queries";

/** RSS 2.0 feed of published journal posts */
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export async function GET() {
  const [posts, site] = await Promise.all([getPublishedPosts(), getSettings("site")]);
  const url = (p: string) => new URL(p, site.url).toString();
  const items = posts
    .slice(0, 50)
    .map(
      (p) => `<item><title>${esc(p.title)}</title><link>${url(`/journal/${p.slug}`)}</link><guid>${url(`/journal/${p.slug}`)}</guid><pubDate>${new Date(p.publishedAt).toUTCString()}</pubDate><description>${esc(p.excerpt)}</description></item>`,
    )
    .join("");
  const xml = `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>${esc(site.title)} — Journal</title><link>${url("/journal")}</link><description>${esc(site.description)}</description>${items}</channel></rss>`;
  return new Response(xml, {
    headers: { "Content-Type": "application/rss+xml; charset=utf-8", "Cache-Control": "public, max-age=600" },
  });
}
