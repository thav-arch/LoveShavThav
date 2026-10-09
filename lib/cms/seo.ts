import type { Project } from "@/lib/project-types";
import type { PostFull } from "./queries";
import type { ProfileSettings, SiteSettings } from "./settings-schema";

/**
 * schema.org structured data (JSON-LD). Helps search engines understand the
 * site as a person's portfolio: Person → CreativeWork projects → BlogPosting.
 */
const abs = (site: SiteSettings, path: string) => new URL(path, site.url).toString();

export function personLd(site: SiteSettings, profile: ProfileSettings) {
  return {
    "@context": "https://schema.org",
    "@type": "Person",
    name: profile.name,
    jobTitle: profile.roles.join(", "),
    description: profile.intro,
    url: site.url,
    email: profile.email || undefined,
    knowsAbout: profile.skills,
    alumniOf: profile.education[1] ? { "@type": "CollegeOrUniversity", name: profile.education[1] } : undefined,
    sameAs: profile.links.map((l) => l.url),
  };
}

export function websiteLd(site: SiteSettings) {
  return { "@context": "https://schema.org", "@type": "WebSite", name: site.title, url: site.url, description: site.description };
}

export function projectLd(
  p: Project,
  site: SiteSettings,
  profile: ProfileSettings,
  meta: { publishedAt: string | null; updatedAt: string } | null,
) {
  return {
    "@context": "https://schema.org",
    "@type": "CreativeWork",
    name: p.title,
    headline: p.title,
    description: p.description || p.subtitle,
    genre: p.category,
    keywords: [...p.tags, ...p.tools].join(", "),
    image: abs(site, p.hero),
    url: abs(site, `/projects/${p.slug}`),
    dateCreated: p.year || undefined,
    datePublished: meta?.publishedAt ?? undefined,
    dateModified: meta?.updatedAt,
    creator: { "@type": "Person", name: profile.name, url: site.url },
  };
}

export function postLd(p: PostFull, site: SiteSettings, profile: ProfileSettings) {
  return {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: p.title,
    description: p.excerpt,
    image: p.cover ? abs(site, p.cover) : undefined,
    url: abs(site, `/journal/${p.slug}`),
    datePublished: p.publishedAt,
    dateModified: p.updatedAt,
    keywords: p.tags.join(", "),
    author: { "@type": "Person", name: p.author ?? profile.name, url: site.url },
  };
}

export function breadcrumbLd(site: SiteSettings, trail: [string, string][]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: trail.map(([name, path], i) => ({ "@type": "ListItem", position: i + 1, name, item: abs(site, path) })),
  };
}
