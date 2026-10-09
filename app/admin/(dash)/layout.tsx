import Link from "next/link";
import { logoutAction } from "@/app/admin/actions";
import { SideNav } from "@/components/admin/SideNav";
import { can, ROLE_LABEL } from "@/lib/cms/auth/rbac";
import { requireUser } from "@/lib/cms/auth/session";
import { collectionKeys, getCollection } from "@/lib/cms/collections";

/** Every page in this group requires a signed-in user. */
export default async function DashLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const groups = [
    {
      label: "Content",
      items: [
        { href: "/admin", label: "Overview" },
        { href: "/admin/projects", label: "Projects" },
        { href: "/admin/posts", label: "Journal" },
      ],
    },
    {
      label: "Sections",
      items: collectionKeys.map((k) => ({ href: `/admin/collections/${k}`, label: getCollection(k).label })),
    },
    {
      label: "Library",
      items: [
        { href: "/admin/media", label: "Media" },
        { href: "/admin/taxonomy", label: "Categories & tags" },
      ],
    },
    {
      label: "Site",
      items: [
        ...(can(user, "read", "settings") ? [{ href: "/admin/settings", label: "Settings & theme" }] : []),
        ...(can(user, "read", "users") ? [{ href: "/admin/users", label: "Users" }] : []),
        { href: "/admin/account", label: "My account" },
      ],
    },
  ];

  return (
    <div className="a-shell">
      <aside className="a-side">
        <Link href="/admin" className="a-brand">
          CMS <small>portfolio</small>
        </Link>
        <SideNav groups={groups} />
        <div className="a-user">
          <strong>{user.name}</strong>
          <em>{ROLE_LABEL[user.role]}</em>
          <div className="a-actions">
            <a className="a-btn small" href="/" target="_blank" rel="noreferrer">
              View site ↗
            </a>
            <form action={logoutAction}>
              <button className="a-btn small ghost">Sign out</button>
            </form>
          </div>
        </div>
      </aside>
      <main className="a-main">{children}</main>
    </div>
  );
}
