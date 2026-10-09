import type { MetadataRoute } from "next";
import { getProjectSeo, getPublishedPosts, getPublishedProjects, getSettings } from "@/lib/cms/queries";

/** /sitemap.xml — generated from published CMS content (noindex items excluded) */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [site, projects, posts] = await Promise.all([getSettings("site"), getPublishedProjects(), getPublishedPosts()]);
  const url = (p: string) => new URL(p, site.url).toString();
  const projectEntries = await Promise.all(
    projects.map(async (p) => {
      const meta = await getProjectSeo(p.slug);
      return meta?.seo.noindex ? null : { url: url(`/projects/${p.slug}`), lastModified: meta?.updatedAt, priority: 0.8 };
    }),
  );
  return [
    { url: url("/"), priority: 1, changeFrequency: "weekly" },
    { url: url("/about"), priority: 0.6 },
    { url: url("/journal"), priority: 0.6, changeFrequency: "weekly" },
    ...projectEntries.filter((e): e is NonNullable<typeof e> => e !== null),
    ...posts.map((p) => ({ url: url(`/journal/${p.slug}`), lastModified: p.updatedAt, priority: 0.5 })),
  ];
}
