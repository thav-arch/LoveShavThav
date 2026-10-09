import Link from "next/link";
import { moveProjectAction, setProjectStatusAction } from "@/app/admin/actions";
import { StatusPill } from "@/components/admin/ui";
import { can } from "@/lib/cms/auth/rbac";
import { requireUser } from "@/lib/cms/auth/session";
import type { Status } from "@/lib/cms/db/schema";
import { listProjects } from "@/lib/cms/services/projects";
import { listCategories } from "@/lib/cms/services/taxonomy";

export const metadata = { title: "Projects" };

const fmt = (d: Date) => d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });

export default async function ProjectsAdmin({ searchParams }: PageProps<"/admin/projects">) {
  const user = await requireUser();
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q : "";
  const status = (typeof sp.status === "string" ? sp.status : "") as Status | "";
  const categoryId = typeof sp.category === "string" ? sp.category : "";
  const [rows, categories] = await Promise.all([listProjects({ q, status, categoryId }), listCategories()]);
  const editor = can(user, "publish", "content");
  const filtered = !!(q || status || categoryId);

  return (
    <div className="a-page">
      <div className="a-head">
        <div>
          <h1>Projects</h1>
          <p>Order here is the order of the 3D carousel. Only published projects appear on the site.</p>
        </div>
        <Link href="/admin/projects/new" className="a-btn primary">
          + New project
        </Link>
      </div>

      <form className="a-filters" role="search">
        <input type="search" name="q" defaultValue={q} placeholder="Search title or slug…" />
        <select name="status" defaultValue={status}>
          <option value="">All statuses</option>
          <option value="published">Published</option>
          <option value="draft">Draft</option>
          <option value="archived">Archived</option>
        </select>
        <select name="category" defaultValue={categoryId}>
          <option value="">All categories</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <button className="a-btn">Filter</button>
        {filtered && (
          <Link href="/admin/projects" className="a-btn ghost">
            Clear
          </Link>
        )}
      </form>

      <div className="a-table-wrap">
        {rows.length === 0 ? (
          <p className="a-empty">{filtered ? "No projects match." : "No projects yet."}</p>
        ) : (
          <table className="a-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Project</th>
                <th>Category</th>
                <th>Status</th>
                <th>Updated</th>
                <th aria-label="Actions" />
              </tr>
            </thead>
            <tbody>
              {rows.map((p, i) => (
                <tr key={p.id}>
                  <td className="num">{i + 1}</td>
                  <td>
                    <Link href={`/admin/projects/${p.id}`} className="a-title">
                      {p.title}
                    </Link>
                    <small>
                      /projects/{p.slug} · {p.subtitle}
                    </small>
                  </td>
                  <td>{p.category ?? "—"}</td>
                  <td>
                    <StatusPill status={p.status} />
                  </td>
                  <td>
                    {fmt(p.updatedAt)}
                    <small>{p.author ?? ""}</small>
                  </td>
                  <td>
                    <div className="a-actions" style={{ justifyContent: "flex-end" }}>
                      {editor && !filtered && (
                        <>
                          <form action={moveProjectAction.bind(null, p.id, -1)} className="a-inline-form">
                            <button className="a-btn small ghost" disabled={i === 0} aria-label={`Move ${p.title} up`}>
                              ↑
                            </button>
                          </form>
                          <form action={moveProjectAction.bind(null, p.id, 1)} className="a-inline-form">
                            <button className="a-btn small ghost" disabled={i === rows.length - 1} aria-label={`Move ${p.title} down`}>
                              ↓
                            </button>
                          </form>
                        </>
                      )}
                      {editor && (
                        <form action={setProjectStatusAction.bind(null, p.id, p.status === "published" ? "draft" : "published")} className="a-inline-form">
                          <button className="a-btn small">{p.status === "published" ? "Unpublish" : "Publish"}</button>
                        </form>
                      )}
                      {p.status === "published" && (
                        <a className="a-btn small ghost" href={`/projects/${p.slug}`} target="_blank" rel="noreferrer">
                          View ↗
                        </a>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
