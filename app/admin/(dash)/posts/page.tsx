import Link from "next/link";
import { StatusPill } from "@/components/admin/ui";
import { requireUser } from "@/lib/cms/auth/session";
import type { Status } from "@/lib/cms/db/schema";
import { listPosts } from "@/lib/cms/services/posts";

export const metadata = { title: "Journal" };

const fmt = (d: Date | null) => (d ? d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "—");

export default async function PostsAdmin({ searchParams }: PageProps<"/admin/posts">) {
  await requireUser();
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q : "";
  const status = (typeof sp.status === "string" ? sp.status : "") as Status | "";
  const rows = await listPosts({ q, status });
  const now = new Date();

  return (
    <div className="a-page">
      <div className="a-head">
        <div>
          <h1>Journal</h1>
          <p>Blog posts and process notes, published at /journal.</p>
        </div>
        <Link href="/admin/posts/new" className="a-btn primary">
          + New post
        </Link>
      </div>
      <form className="a-filters" role="search">
        <input type="search" name="q" defaultValue={q} placeholder="Search…" />
        <select name="status" defaultValue={status}>
          <option value="">All statuses</option>
          <option value="published">Published</option>
          <option value="draft">Draft</option>
          <option value="archived">Archived</option>
        </select>
        <button className="a-btn">Filter</button>
      </form>
      <div className="a-table-wrap">
        {rows.length === 0 ? (
          <p className="a-empty">
            No posts yet. <Link href="/admin/posts/new">Write the first one →</Link>
          </p>
        ) : (
          <table className="a-table">
            <thead>
              <tr>
                <th>Post</th>
                <th>Category</th>
                <th>Status</th>
                <th>Publish date</th>
                <th>Author</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((p) => {
                const scheduled = p.status === "published" && p.publishedAt && p.publishedAt > now;
                return (
                  <tr key={p.id}>
                    <td>
                      <Link href={`/admin/posts/${p.id}`} className="a-title">
                        {p.title}
                      </Link>
                      <small>/journal/{p.slug}</small>
                    </td>
                    <td>{p.category ?? "—"}</td>
                    <td>
                      <StatusPill status={scheduled ? "scheduled" : p.status} />
                    </td>
                    <td>{fmt(p.publishedAt)}</td>
                    <td>{p.author ?? "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
