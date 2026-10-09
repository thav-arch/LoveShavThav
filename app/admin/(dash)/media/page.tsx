import { MediaLibrary } from "@/components/admin/MediaLibrary";
import { can } from "@/lib/cms/auth/rbac";
import { requireUser } from "@/lib/cms/auth/session";
import { listMedia } from "@/lib/cms/services/media";

export const metadata = { title: "Media" };

export default async function MediaPage() {
  const user = await requireUser();
  const items = (await listMedia("", 500)).map((m) => ({ ...m, createdAt: m.createdAt.toISOString() }));
  return (
    <div className="a-page">
      <div className="a-head">
        <div>
          <h1>Media</h1>
          <p>Images are converted to WebP (max 2560px) with a small preview for fast 3D loading.</p>
        </div>
      </div>
      <MediaLibrary items={items} canDelete={can(user, "delete", "media")} />
    </div>
  );
}
