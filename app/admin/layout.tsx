import type { Metadata } from "next";
import "./admin.css";

export const metadata: Metadata = {
  title: { default: "CMS", template: "%s · CMS" },
  robots: { index: false, follow: false },
};

/** The dashboard never renders the 3D shell — it's a plain, fast admin UI. */
export default function AdminRoot({ children }: { children: React.ReactNode }) {
  return <div className="admin-root">{children}</div>;
}
