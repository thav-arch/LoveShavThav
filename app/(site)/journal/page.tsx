import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { EditorialPage } from "@/components/EditorialPage";
import { getPublishedPosts } from "@/lib/cms/queries";

export const metadata: Metadata = {
  title: "Journal",
  description: "Notes on game design, systems, narrative and process.",
  alternates: { canonical: "/journal" },
};

const date = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

export default async function JournalPage() {
  const posts = await getPublishedPosts();
  return (
    <EditorialPage label="Journal">
      <section className="cs-hero">
        <p className="cs-eyebrow" data-intro>
          Journal — {posts.length} {posts.length === 1 ? "entry" : "entries"}
        </p>
        <h1 className="cs-title" data-intro>
          Journal
        </h1>
        <p className="cs-lede" data-intro>
          Notes on game design, systems, narrative and process.
        </p>
      </section>

      {posts.length === 0 ? (
        <p className="jr-empty" data-intro>
          Nothing published yet.
        </p>
      ) : (
        <ol className="jr-list">
          {posts.map((p) => (
            <li key={p.id} data-reveal>
              <Link href={`/journal/${p.slug}`} className="jr-item">
                <span className="jr-date">{date(p.publishedAt)}</span>
                <span className="jr-text">
                  <strong>{p.title}</strong>
                  {p.excerpt && <span>{p.excerpt}</span>}
                  <em>
                    {[p.category, `${p.minutes} min read`, ...p.tags.slice(0, 3)].filter(Boolean).join(" · ")}
                  </em>
                </span>
                {p.cover && (
                  <span className="jr-thumb">
                    <Image src={p.cover} alt={p.coverAlt} fill sizes="240px" />
                  </span>
                )}
              </Link>
            </li>
          ))}
        </ol>
      )}
    </EditorialPage>
  );
}
