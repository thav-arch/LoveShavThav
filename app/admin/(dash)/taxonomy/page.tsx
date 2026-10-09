import { TaxonomyManager } from "@/components/admin/TaxonomyManager";
import { can } from "@/lib/cms/auth/rbac";
import { requireUser } from "@/lib/cms/auth/session";
import { listCategories, listTagsWithCounts } from "@/lib/cms/services/taxonomy";

export const metadata = { title: "Categories & tags" };

export default async function TaxonomyPage() {
  const user = await requireUser();
  const [categories, tags] = await Promise.all([listCategories(), listTagsWithCounts()]);
  return (
    <div className="a-page">
      <div className="a-head">
        <div>
          <h1>Categories & tags</h1>
          <p>Organise projects and posts.</p>
        </div>
      </div>
      <TaxonomyManager categories={categories} tags={tags} canEdit={can(user, "update", "taxonomy")} />
    </div>
  );
}
