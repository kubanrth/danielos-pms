import { db } from "@/lib/db";
import { requireSuperAdmin } from "@/lib/admin-guard";
import { BackupsClient } from "@/app/(admin)/admin/backups/backups-client";

// F12-K34: panel admina z listą wszystkich workspace'ów + ich dziennych
// backupów. Fetch zwraca tylko index (WorkspaceBackup metadata) — pliki
// JSON są w Supabase Storage, pobrane on-demand przez signed URL.

export default async function AdminBackupsPage() {
  await requireSuperAdmin();

  // 1 query: wszystkie workspace'y (włącznie z soft-deleted, jeśli mają
  // backupy — chcemy widzieć historię nawet po usunięciu workspace'u).
  const workspaces = await db.workspace.findMany({
    where: {
      OR: [
        { deletedAt: null },
        { backups: { some: {} } },
      ],
    },
    orderBy: [{ deletedAt: { sort: "asc", nulls: "first" } }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      deletedAt: true,
      backups: {
        orderBy: { dayKey: "desc" },
        select: {
          id: true,
          dayKey: true,
          sizeBytes: true,
          modelCounts: true,
          createdAt: true,
        },
      },
    },
  });

  const rows = workspaces.map((w) => ({
    id: w.id,
    name: w.name,
    deletedAt: w.deletedAt ? w.deletedAt.toISOString() : null,
    backups: w.backups.map((b) => ({
      id: b.id,
      dayKey: b.dayKey,
      sizeBytes: b.sizeBytes,
      modelCounts: b.modelCounts as Record<string, number>,
      createdAt: b.createdAt.toISOString(),
    })),
  }));

  return (
    <main className="flex-1 px-8 py-10 md:px-14 md:py-14">
      <div className="mx-auto flex max-w-6xl flex-col gap-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="flex flex-col gap-2">
            <span className="eyebrow">Backupy</span>
            <h1 className="font-display text-[2rem] font-bold leading-[1.1] tracking-[-0.03em]">
              Dzienne kopie workspace&apos;ów
            </h1>
            <p className="max-w-[64ch] text-[0.92rem] leading-relaxed text-muted-foreground">
              Cron tworzy snapshot każdego workspace&apos;u raz dziennie
              (01:00 UTC). Plik JSON zawiera całą metadatę: boardy, taski,
              briefy, support, komentarze, audit log. Możesz też ręcznie
              wymusić backup teraz.
            </p>
          </div>
        </div>

        <BackupsClient rows={rows} />
      </div>
    </main>
  );
}
