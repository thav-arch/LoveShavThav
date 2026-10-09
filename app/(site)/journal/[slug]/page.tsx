import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import { EditorialPage } from "@/components/EditorialPage";
import { JsonLd } from "@/components/JsonLd";
import { getPostBySlug, getPublishedPosts, getRedirect, getSettings } from "@/lib/cms/queries";
import { breadcrumbLd, postLd } from "@/lib/cms/seo";

type Params = { params: Promise<{ slug: string }> };

export async function generateStaticParams() {
  return (await getPublishedPosts()).map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const post = await getPostBySlug((await params).slug);
  if (!post) return {};
  const title = post.seo.title || post.title;
  const description = post.seo.description || post.excerpt;
  const image = post.seo.ogImage || post.cover || undefined;
  return {
    title,
    description,
    alternates: { canonical: post.seo.canonical || `/journal/${post.slug}` },
    robots: post.seo.noindex ? { index: false, follow: true } : undefined,
    openGraph: {
      type: "article",
      title,
      description,
      images: image ? [image] : undefined,
      publishedTime: post.publishedAt,
      modifiedTime: post.updatedAt,
      tags: post.tags,
    },
    twitter: { card: image ? "summary_large_image" : "summary", title, description },
  };
}

export default async function PostPage({ params }: Params) {
  const { slug } = await params;
  const post = await getPostBySlug(slug);
  if (!post) {
    const to = await getRedirect(`/journal/${slug}`);
    if (to) permanentRedirect(to);
    notFound();
  }
  const [site, profile] = await Promise.all([getSettings("site"), getSettings("profile")]);
  const date = new Date(post.publishedAt).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });

  return (
    <EditorialPage label="Journal">
      <JsonLd
        data={[
          postLd(post, site, profile),
          breadcrumbLd(site, [
            ["Journal", "/journal"],
            [post.title, `/journal/${post.slug}`],
          ]),
        ]}
      />
      <article>
        <header className="cs-hero">
          <p className="cs-eyebrow" data-intro>
            <Link href="/journal">Journal</Link> — {date} · {post.minutes} min read
          </p>
          <h1 className="cs-title cs-title-post" data-intro>
            {post.title}
          </h1>
          {post.excerpt && (
            <p className="cs-lede" data-intro>
              {post.excerpt}
            </p>
          )}
        </header>
        {post.cover && (
          <figure className="cs-media cs-hero-media" data-intro>
            <div className="cs-frame">
              <div className="cs-parallax" data-parallax>
                <Image src={post.cover} alt={post.coverAlt} fill sizes="(max-width: 900px) 100vw, 80vw" priority />
              </div>
            </div>
          </figure>
        )}
        {/* Markdown rendered and sanitised on the server (lib/cms/markdown.ts) */}
        <div className="post-body prose" dangerouslySetInnerHTML={{ __html: post.html }} />
        {post.tags.length > 0 && (
          <p className="post-tags">
            {post.tags.map((t) => (
              <span key={t}>{t}</span>
            ))}
          </p>
        )}
      </article>
    </EditorialPage>
  );
}
