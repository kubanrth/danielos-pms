import Link from "next/link";
import { ShieldCheck, Users, Layers, ScrollText, ArrowLeft, Gavel } from "lucide-react";
import { requireSuperAdmin } from "@/lib/admin-guard";
import { AdminNavItem } from "@/components/admin/admin-nav-item";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireSuperAdmin();

  return (
    <div className="flex min-h-dvh bg-background">
      <aside className="flex w-[240px] flex-col gap-2 border-r border-sidebar-border bg-sidebar px-3 py-4">
        <div className="flex items-center gap-2 px-2 py-1">
          <span className="grid h-7 w-7 place-items-center rounded-md bg-primary text-primary-foreground">
            <ShieldCheck size={14} />
          </span>
          <div className="flex flex-col leading-tight">
            <span className="font-display text-[0.92rem] font-semibold tracking-[-0.01em]">
              Panel admina
            </span>
            <span className="font-mono text-[0.6rem] uppercase tracking-[0.14em] text-muted-foreground">
              super admin
            </span>
          </div>
        </div>

        <nav className="mt-2 flex flex-col gap-0.5">
          <AdminNavItem href="/admin" exact label="Przegląd" icon={<ShieldCheck size={14} />} />
          <AdminNavItem href="/admin/users" label="Użytkownicy" icon={<Users size={14} />} />
          <AdminNavItem href="/admin/workspaces" label="Przestrzenie" icon={<Layers size={14} />} />
          <AdminNavItem href="/admin/audit" label="Audyt workspace" icon={<ScrollText size={14} />} />
          <AdminNavItem href="/admin/actions" label="Akcje admina" icon={<Gavel size={14} />} />
        </nav>

        <div className="mt-auto border-t border-sidebar-border pt-3">
          <Link
            href="/workspaces"
            className="flex items-center gap-2 rounded-sm px-2 py-1.5 text-[0.84rem] text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-foreground"
          >
            <ArrowLeft size={14} /> Wróć do aplikacji
          </Link>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">{children}</div>
    </div>
  );
}
