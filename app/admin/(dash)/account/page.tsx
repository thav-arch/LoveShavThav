import { PasswordForm } from "@/components/admin/PasswordForm";
import { ROLE_LABEL } from "@/lib/cms/auth/rbac";
import { requireUser } from "@/lib/cms/auth/session";

export const metadata = { title: "My account" };

export default async function AccountPage() {
  const user = await requireUser();
  return (
    <div className="a-page">
      <div className="a-head">
        <div>
          <h1>My account</h1>
          <p>
            {user.name} · {user.email} · {ROLE_LABEL[user.role]}
          </p>
        </div>
      </div>
      <PasswordForm />
    </div>
  );
}
