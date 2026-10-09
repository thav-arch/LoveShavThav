import { redirect } from "next/navigation";
import { MusicForm } from "@/components/admin/MusicFields";
import { ProfileForm, SiteForm, ThemeForm } from "@/components/admin/SettingsForms";
import { can } from "@/lib/cms/auth/rbac";
import { requireUser } from "@/lib/cms/auth/session";
import { readSettings } from "@/lib/cms/services/settings";

export const metadata = { title: "Settings" };

export default async function SettingsPage() {
  const user = await requireUser();
  if (!can(user, "read", "settings")) redirect("/admin");
  const readOnly = !can(user, "update", "settings");
  const [site, profile, theme, music] = await Promise.all([readSettings("site"), readSettings("profile"), readSettings("theme"), readSettings("music")]);
  return (
    <div className="a-page">
      <div className="a-head">
        <div>
          <h1>Settings & theme</h1>
          <p>{readOnly ? "Read-only — only admins can change site settings." : "Site identity, profile, branding and music."}</p>
        </div>
      </div>
      <SiteForm initial={site} readOnly={readOnly} />
      <ProfileForm initial={profile} readOnly={readOnly} />
      <ThemeForm initial={theme} readOnly={readOnly} />
      <MusicForm initial={music} readOnly={readOnly} />
    </div>
  );
}
