import { notFound } from "next/navigation";
import { EntryForm } from "@/components/admin/EntryForm";
import { can } from "@/lib/cms/auth/rbac";
import { requireUser } from "@/lib/cms/auth/session";
import { getCollection, isCollection } from "@/lib/cms/collections";
import { getEntry } from "@/lib/cms/services/entries";

export async function generateMetadata({ params }: PageProps<"/admin/collections/[type]/[id]">) {
  const { type, id } = await params;
  if (!isCollection(type)) return { title: "Not found" };
  return { title: `${id === "new" ? "New" : "Edit"} ${getCollection(type).singular.toLowerCase()}` };
}

/** handles both /new and /<uuid> */
export default async function EntryPage({ params }: PageProps<"/admin/collections/[type]/[id]">) {
  const user = await requireUser();
  const { type, id } = await params;
  if (!isCollection(type)) notFound();
  const isNew = id === "new";
  if (!isNew && !/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const entry = isNew ? null : await getEntry(type, id);
  if (!isNew && !entry) notFound();
  const ownDraft = !!entry && entry.authorId === user.id && entry.status !== "published";

  return (
    <div className="a-page">
      <EntryForm
        collection={type}
        def={getCollection(type)}
        id={entry?.id ?? null}
        initial={entry?.data ?? {}}
        initialStatus={entry?.status ?? "draft"}
        canPublish={can(user, "publish", "content")}
        canDelete={can(user, "delete", "content") || (user.role === "author" && ownDraft)}
      />
    </div>
  );
}
