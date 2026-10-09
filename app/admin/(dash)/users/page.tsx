import { redirect } from "next/navigation";
import { UserManager } from "@/components/admin/UserManager";
import { can } from "@/lib/cms/auth/rbac";
import { requireUser } from "@/lib/cms/auth/session";
import { listUsers } from "@/lib/cms/services/users";

export const metadata = { title: "Users" };

export default async function UsersPage() {
  const user = await requireUser();
  if (!can(user, "read", "users")) redirect("/admin");
  const users = (await listUsers()).map((u) => ({ ...u, lastLoginAt: u.lastLoginAt?.toISOString() ?? null, createdAt: undefined }));
  return (
    <div className="a-page">
      <div className="a-head">
        <div>
          <h1>Users</h1>
          <p>Admins manage everything · Editors publish content · Authors write drafts.</p>
        </div>
      </div>
      <UserManager users={users} me={user.id} />
    </div>
  );
}
