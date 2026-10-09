import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { JsonLd } from "@/components/JsonLd";
import { ProjectCaseStudy } from "@/components/ProjectCaseStudy";
import { getProjectBySlug, getProjectSeo, getPublishedProjects, getRedirect, getSettings } from "@/lib/cms/queries";
import { breadcrumbLd, projectLd } from "@/lib/cms/seo";

type Params = { params: Promise<{ slug: string }> };

// prerender every published project; new ones render on first visit, then stay cached
export async function generateStaticParams() {
  return (await getPublishedProjects()).map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const p = await getProjectBySlug(slug);
  if (!p) return {};
  const seo = (await getProjectSeo(slug))?.seo ?? {};
  const title = seo.title || p.title;
  const description = seo.description || p.description || p.subtitle;
  const image = seo.ogImage || p.hero;
  return {
    title,
    description,
    alternates: { canonical: seo.canonical || `/projects/${p.slug}` },
    robots: seo.noindex ? { index: false, follow: true } : undefined,
    openGraph: { type: "article", title, description, images: [image] },
    twitter: { card: "summary_large_image", title, description, images: [image] },
  };
}

export default async function ProjectPage({ params }: Params) {
  const { slug } = await params;
  const project = await getProjectBySlug(slug);
  if (!project) {
    // old slug? send search engines and visitors to the new URL
    const to = await getRedirect(`/projects/${slug}`);
    if (to) permanentRedirect(to);
    notFound();
  }
  const [site, profile, meta] = await Promise.all([getSettings("site"), getSettings("profile"), getProjectSeo(slug)]);
  return (
    <>
      <JsonLd
        data={[
          projectLd(project, site, profile, meta),
          breadcrumbLd(site, [
            ["Work", "/"],
            [project.title, `/projects/${project.slug}`],
          ]),
        ]}
      />
      <ProjectCaseStudy key={slug} project={project} />
    </>
  );
}
