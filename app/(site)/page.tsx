import Link from "next/link";
import { JsonLd } from "@/components/JsonLd";
import { getPublishedProjects, getSettings } from "@/lib/cms/queries";
import { personLd, websiteLd } from "@/lib/cms/seo";

/**
 * The homepage world is rendered by the persistent <PortfolioShell>. This
 * page adds crawlable HTML (headline, project links) and structured data.
 */
export default async function Home() {
  const [projects, site, profile] = await Promise.all([getPublishedProjects(), getSettings("site"), getSettings("profile")]);
  return (
    <main className="sr-only">
      <JsonLd data={[websiteLd(site), personLd(site, profile)]} />
      <h1>
        {profile.name} — {profile.roles.join(", ")}
      </h1>
      <p>{profile.intro}</p>
      <ul>
        {projects.map((p) => (
          <li key={p.slug}>
            <Link href={`/projects/${p.slug}`}>
              {p.title} — {p.subtitle}
            </Link>
          </li>
        ))}
      </ul>
      <Link href="/journal">Journal</Link> <Link href="/about">About</Link>
    </main>
  );
}
