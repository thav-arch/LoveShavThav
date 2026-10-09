import { emptyProject, ProjectForm } from "@/components/admin/ProjectForm";
import { can } from "@/lib/cms/auth/rbac";
import { requireUser } from "@/lib/cms/auth/session";
import { listCategories } from "@/lib/cms/services/taxonomy";

export const metadata = { title: "New project" };

export default async function NewProject() {
  const user = await requireUser();
  const categories = await listCategories();
  return (
    <div className="a-page">
      <ProjectForm
        id={null}
        initial={emptyProject}
        categories={categories.filter((c) => c.scope !== "post")}
        canPublish={can(user, "publish", "content")}
        canDelete={false}
      />
    </div>
  );
}
