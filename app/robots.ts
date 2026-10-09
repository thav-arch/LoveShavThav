import type { MetadataRoute } from "next";
import { getSettings } from "@/lib/cms/queries";

export default async function robots(): Promise<MetadataRoute.Robots> {
  const site = await getSettings("site");
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/admin", "/api/"] }],
    sitemap: new URL("/sitemap.xml", site.url).toString(),
  };
}
