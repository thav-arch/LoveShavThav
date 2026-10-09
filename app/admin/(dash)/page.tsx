import { count, desc, eq } from "drizzle-orm";
import Link from "next/link";
import { StatusPill } from "@/components/admin/ui";
import { requireUser } from "@/lib/cms/auth/session";
import { collectionKeys, getCollection } from "@/lib/cms/collections";
import { db, schema } from "@/lib/cms/db";

export const metadata = { title: "Overview" };

async function counts(table: typeof schema.projects | typeof schema.posts) {
  const rows = await db.select({ status: table.status, n: count() }).from(table).groupBy(table.status);
  const by = Object.fromEntries(rows.map((r) => [r.status, Number(r.n)]));
  return { published: by.published ?? 0, draft: by.draft ?? 0, total: rows.reduce((a, r) => a + Number(r.n), 0) };
}

export default async function Overview() {
  const user = await requireUser();
  const [projects, posts, [{ n: mediaCount }], recentProjects, recentPosts, entryCounts] = await Promise.all([
    counts(schema.projects),
    counts(schema.posts),
    db.select({ n: count() }).from(schema.media),
    db
      .select({ id: schema.projects.id, title: schema.projects.title, status: schema.projects.status, updatedAt: schema.projects.updatedAt })
      .from(schema.projects)
      .orderBy(desc(schema.projects.updatedAt))
      .limit(5),
    db
      .select({ id: schema.posts.id, title: schema.posts.title, status: schema.posts.status, updatedAt: schema.posts.updatedAt })
      .from(schema.posts)
      .orderBy(desc(schema.posts.updatedAt))
      .limit(5),
    Promise.all(
      collectionKeys.map(async (k) => ({
        k,
        n: Number((await db.select({ n: count() }).from(schema.entries).where(eq(schema.entries.collection, k)))[0].n),
      })),
    ),
  ]);
  const recent = [
    ...recentProjects.map((r) => ({ ...r, href: `/admin/projects/${r.id}`, kind: "Project" })),
    ...recentPosts.map((r) => ({ ...r, href: `/admin/posts/${r.id}`, kind: "Post" })),
  ]
    .sort((a, b) => +b.updatedAt - +a.updatedAt)
    .slice(0, 8);

  return (
    <div className="a-page">
      <div className="a-head">
        <div>
          <h1>Hello, {user.name.split(" ")[0]}</h1>
          <p>Everything you publish here updates the live portfolio immediately.</p>
        </div>
        <div className="a-actions">
          <Link href="/admin/projects/new" className="a-btn primary">
            + Project
          </Link>
          <Link href="/admin/posts/new" className="a-btn">
            + Journal post
          </Link>
        </div>
      </div>

      <div className="a-stats">
        <Link className="a-stat" href="/admin/projects">
          <b>{projects.published}</b>
          <span>
            published projects{projects.draft ? ` · ${projects.draft} draft` : ""}
          </span>
        </Link>
        <Link className="a-stat" href="/admin/posts">
          <b>{posts.published}</b>
          <span>journal posts{posts.draft ? ` · ${posts.draft} draft` : ""}</span>
        </Link>
        <Link className="a-stat" href="/admin/media">
          <b>{Number(mediaCount)}</b>
          <span>media files</span>
        </Link>
        {entryCounts.map(({ k, n }) => (
          <Link key={k} className="a-stat" href={`/admin/collections/${k}`}>
            <b>{n}</b>
            <span>{getCollection(k).label.toLowerCase()}</span>
          </Link>
        ))}
      </div>

      <section className="a-panel">
        <h2>Recently edited</h2>
        <table className="a-table" style={{ marginTop: 8 }}>
          <tbody>
            {recent.map((r) => (
              <tr key={r.href}>
                <td>
                  <Link className="a-title" href={r.href}>
                    {r.title}
                  </Link>
                  <small>{r.kind}</small>
                </td>
                <td>
                  <StatusPill status={r.status} />
                </td>
                <td className="num">{r.updatedAt.toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!recent.length && <p className="a-empty">Nothing yet.</p>}
      </section>
    </div>
  );
}
