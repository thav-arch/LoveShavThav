import { emptyPost, PostForm } from "@/components/admin/PostForm";
import { can } from "@/lib/cms/auth/rbac";
import { requireUser } from "@/lib/cms/auth/session";
import { listCategories } from "@/lib/cms/services/taxonomy";

export const metadata = { title: "New post" };

export default async function NewPost() {
  const user = await requireUser();
  const categories = (await listCategories()).filter((c) => c.scope !== "project");
  return (
    <div className="a-page">
      <PostForm id={null} initial={emptyPost} categories={categories} canPublish={can(user, "publish", "content")} canDelete={false} />
    </div>
  );
}
