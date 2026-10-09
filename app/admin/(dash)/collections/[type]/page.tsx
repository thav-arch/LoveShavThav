import Link from "next/link";
import { notFound } from "next/navigation";
import { moveEntryAction } from "@/app/admin/actions";
import { StatusPill } from "@/components/admin/ui";
import { can } from "@/lib/cms/auth/rbac";
import { requireUser } from "@/lib/cms/auth/session";
import { getCollection, isCollection } from "@/lib/cms/collections";
import { listEntries } from "@/lib/cms/services/entries";

export async function generateMetadata({ params }: PageProps<"/admin/collections/[type]">) {
  const { type } = await params;
  return { title: isCollection(type) ? getCollection(type).label : "Not found" };
}

export default async function CollectionList({ params }: PageProps<"/admin/collections/[type]">) {
  const user = await requireUser();
  const { type } = await params;
  if (!isCollection(type)) notFound();
  const def = getCollection(type);
  const rows = await listEntries(type);
  const editor = can(user, "publish", "content");
  const second = def.fields.find((f) => f.name !== def.titleField && f.type === "text");

  return (
    <div className="a-page">
      <div className="a-head">
        <div>
          <h1>{def.label}</h1>
          <p>
            {def.description} Published items appear on <a href="/about">/about</a> and at <code>/api/v1/collections/{type}</code>.
          </p>
        </div>
        <Link href={`/admin/collections/${type}/new`} className="a-btn primary">
          + New {def.singular.toLowerCase()}
        </Link>
      </div>
      <div className="a-table-wrap">
        {rows.length === 0 ? (
          <p className="a-empty">Nothing here yet.</p>
        ) : (
          <table className="a-table">
            <thead>
              <tr>
                <th>{def.fields.find((f) => f.name === def.titleField)?.label}</th>
                {second && <th>{second.label}</th>}
                <th>Status</th>
                <th aria-label="Order" />
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={r.id}>
                  <td>
                    <Link className="a-title" href={`/admin/collections/${type}/${r.id}`}>
                      {String(r.data[def.titleField] || "(untitled)")}
                    </Link>
                  </td>
                  {second && <td>{String(r.data[second.name] ?? "")}</td>}
                  <td>
                    <StatusPill status={r.status} />
                  </td>
                  <td>
                    {editor && (
                      <div className="a-actions" style={{ justifyContent: "flex-end" }}>
                        <form action={moveEntryAction.bind(null, type, r.id, -1)} className="a-inline-form">
                          <button className="a-btn small ghost" disabled={i === 0} aria-label="Move up">
                            ↑
                          </button>
                        </form>
                        <form action={moveEntryAction.bind(null, type, r.id, 1)} className="a-inline-form">
                          <button className="a-btn small ghost" disabled={i === rows.length - 1} aria-label="Move down">
                            ↓
                          </button>
                        </form>
                      </div>
                    )}
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
