"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function AdminNavItem({
  href,
  label,
  icon,
  exact,
}: {
  href: string;
  label: string;
  icon: React.ReactNode;
  exact?: boolean;
}) {
  const pathname = usePathname();
  const active = exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
  return (
    <Link
      href={href}
      data-active={active ? "true" : "false"}
      className="group flex items-center gap-2 rounded-sm px-2 py-1.5 text-[0.88rem] text-sidebar-foreground transition-colors hover:bg-sidebar-accent data-[active=true]:bg-sidebar-accent data-[active=true]:text-foreground"
    >
      <span className="shrink-0 text-muted-foreground group-hover:text-foreground group-data-[active=true]:text-foreground">
        {icon}
      </span>
      <span className="truncate">{label}</span>
    </Link>
  );
}
