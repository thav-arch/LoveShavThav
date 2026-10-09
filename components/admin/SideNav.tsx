"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type Group = { label: string; items: { href: string; label: string }[] };

export function SideNav({ groups }: { groups: Group[] }) {
  const path = usePathname();
  const active = (href: string) => (href === "/admin" ? path === "/admin" : path.startsWith(href));
  return (
    <nav className="a-nav" aria-label="Dashboard">
      {groups.map((g) => (
        <div key={g.label} className="a-nav" role="group" aria-label={g.label}>
          <p className="a-nav-label">{g.label}</p>
          {g.items.map((i) => (
            <Link key={i.href} href={i.href} aria-current={active(i.href) ? "page" : undefined}>
              {i.label}
            </Link>
          ))}
        </div>
      ))}
    </nav>
  );
}
