import Link from "next/link";
import { db } from "@/lib/db";
import { Users, Layers, FileText, Activity } from "lucide-react";

export default async function AdminDashboard() {
  // Server components run fresh per request; `Date.now()` here is a
  // fixed-point snapshot for this render, not a React render-time impurity.
  // eslint-disable-next-line react-hooks/purity
  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const [userCount, bannedCount, workspaceCount, deletedWorkspaces, taskCount, commentCount, lastDayAudits] =
    await Promise.all([
      db.user.count({ where: { deletedAt: null } }),
      db.user.count({ where: { isBanned: true, deletedAt: null } }),
      db.workspace.count({ where: { deletedAt: null } }),
      db.workspace.count({ where: { deletedAt: { not: null } } }),
      db.task.count({ where: { deletedAt: null } }),
      db.comment.count({ where: { deletedAt: null } }),
      db.auditLog.count({ where: { createdAt: { gte: since24h } } }),
    ]);

  return (
    <main className="flex-1 px-8 py-10 md:px-14 md:py-14">
      <div className="mx-auto flex max-w-5xl flex-col gap-8">
        <div className="flex flex-col gap-2">
          <span className="eyebrow">Panel admina</span>
          <h1 className="font-display text-[2.2rem] font-bold leading-[1.1] tracking-[-0.03em]">
            Przegląd systemu.
          </h1>
          <p className="max-w-[60ch] text-[0.95rem] leading-[1.55] text-muted-foreground">
            Zarządzanie użytkownikami, przestrzeniami i globalny audyt — wszystko bez kontaktu
            z developerem.
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            icon={<Users size={16} />}
            label="Użytkownicy"
            value={userCount}
            note={bannedCount > 0 ? `${bannedCount} zbanowanych` : undefined}
            href="/admin/users"
          />
          <StatCard
            icon={<Layers size={16} />}
            label="Przestrzenie"
            value={workspaceCount}
            note={deletedWorkspaces > 0 ? `${deletedWorkspaces} usuniętych` : undefined}
            href="/admin/workspaces"
          />
          <StatCard
            icon={<FileText size={16} />}
            label="Zadania"
            value={taskCount}
            note={`${commentCount} komentarzy`}
          />
          <StatCard
            icon={<Activity size={16} />}
            label="Akcje (24h)"
            value={lastDayAudits}
            href="/admin/audit"
          />
        </div>
      </div>
    </main>
  );
}

function StatCard({
  icon,
  label,
  value,
  note,
  href,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  note?: string;
  href?: string;
}) {
  const body = (
    <div className="flex flex-col gap-1 rounded-lg border border-border bg-card p-4 transition-colors hover:border-primary/60">
      <span className="flex items-center gap-1.5 font-mono text-[0.66rem] uppercase tracking-[0.14em] text-muted-foreground">
        <span className="text-primary">{icon}</span>
        {label}
      </span>
      <span className="font-display text-[1.8rem] font-bold tracking-[-0.02em]">
        {value.toLocaleString("pl-PL")}
      </span>
      {note && (
        <span className="font-mono text-[0.62rem] uppercase tracking-[0.12em] text-muted-foreground">
          {note}
        </span>
      )}
    </div>
  );
  if (href) return <Link href={href}>{body}</Link>;
  return body;
}
