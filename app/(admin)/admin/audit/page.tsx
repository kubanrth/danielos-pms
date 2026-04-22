import { db } from "@/lib/db";
import { requireSuperAdmin } from "@/lib/admin-guard";

// Query params: ?action=task.created&actor=admin@…&days=7
async function loadAudit(params: { action?: string; actor?: string; days?: string }) {
  const days = Number.parseInt(params.days ?? "", 10);
  const sinceMs = Number.isFinite(days) && days > 0 ? days * 24 * 60 * 60 * 1000 : null;

  return db.auditLog.findMany({
    where: {
      ...(params.action ? { action: { contains: params.action, mode: "insensitive" } } : {}),
      ...(params.actor
        ? {
            actor: {
              OR: [
                { email: { contains: params.actor, mode: "insensitive" } },
                { name: { contains: params.actor, mode: "insensitive" } },
              ],
            },
          }
        : {}),
      ...(sinceMs
        ? { createdAt: { gte: new Date(Date.now() - sinceMs) } }
        : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 200,
    include: {
      actor: { select: { id: true, name: true, email: true } },
      workspace: { select: { id: true, name: true, slug: true } },
    },
  });
}

type AuditRow = Awaited<ReturnType<typeof loadAudit>>[number];

export default async function AdminAuditPage({
  searchParams,
}: {
  searchParams: Promise<{ action?: string; actor?: string; days?: string }>;
}) {
  await requireSuperAdmin();
  const params = await searchParams;
  const entries = await loadAudit(params);

  return (
    <main className="flex-1 px-8 py-10 md:px-14 md:py-14">
      <div className="mx-auto flex max-w-6xl flex-col gap-6">
        <div className="flex flex-col gap-2">
          <span className="eyebrow">Audyt</span>
          <h1 className="font-display text-[2rem] font-bold leading-[1.1] tracking-[-0.03em]">
            Globalna historia aktywności
          </h1>
          <p className="text-[0.88rem] text-muted-foreground">
            Ostatnie 200 wpisów ze wszystkich przestrzeni. Filtry działają po literale „zawiera”.
          </p>
        </div>

        <form
          action="/admin/audit"
          className="flex flex-wrap items-end gap-3 rounded-lg border border-border bg-card p-3"
        >
          <label className="flex flex-col gap-1">
            <span className="font-mono text-[0.62rem] uppercase tracking-[0.14em] text-muted-foreground">
              Akcja
            </span>
            <input
              name="action"
              defaultValue={params.action ?? ""}
              placeholder="np. task.updated"
              className="h-9 w-[220px] rounded-md border border-border bg-background px-3 text-[0.86rem] outline-none focus:border-primary"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="font-mono text-[0.62rem] uppercase tracking-[0.14em] text-muted-foreground">
              Użytkownik
            </span>
            <input
              name="actor"
              defaultValue={params.actor ?? ""}
              placeholder="email / imię"
              className="h-9 w-[220px] rounded-md border border-border bg-background px-3 text-[0.86rem] outline-none focus:border-primary"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="font-mono text-[0.62rem] uppercase tracking-[0.14em] text-muted-foreground">
              Okres
            </span>
            <select
              name="days"
              defaultValue={params.days ?? ""}
              className="h-9 rounded-md border border-border bg-background px-3 font-mono text-[0.78rem] uppercase tracking-[0.12em] outline-none focus:border-primary"
            >
              <option value="">wszystko</option>
              <option value="1">24 h</option>
              <option value="7">7 dni</option>
              <option value="30">30 dni</option>
              <option value="90">90 dni</option>
            </select>
          </label>
          <button
            type="submit"
            className="inline-flex h-9 items-center rounded-md border border-border bg-background px-3 font-mono text-[0.7rem] uppercase tracking-[0.14em] text-muted-foreground transition-colors hover:text-foreground"
          >
            Zastosuj
          </button>
        </form>

        <div className="overflow-hidden rounded-xl border border-border bg-card">
          <table className="w-full text-left">
            <thead className="border-b border-border bg-muted/50">
              <tr className="font-mono text-[0.62rem] uppercase tracking-[0.14em] text-muted-foreground">
                <th className="px-4 py-2">Czas</th>
                <th className="px-4 py-2">Akcja</th>
                <th className="px-4 py-2">Obiekt</th>
                <th className="px-4 py-2">Użytkownik</th>
                <th className="px-4 py-2">Przestrzeń</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((e) => (
                <AuditRowView key={e.id} entry={e} />
              ))}
            </tbody>
          </table>
          {entries.length === 0 && (
            <p className="px-4 py-8 text-center text-[0.88rem] text-muted-foreground">
              Brak wpisów.
            </p>
          )}
        </div>
      </div>
    </main>
  );
}

function AuditRowView({ entry }: { entry: AuditRow }) {
  return (
    <tr className="border-b border-border last:border-b-0">
      <td className="px-4 py-2 font-mono text-[0.72rem] uppercase tracking-[0.12em] text-muted-foreground">
        {new Date(entry.createdAt).toLocaleString("pl-PL", {
          day: "numeric",
          month: "short",
          hour: "2-digit",
          minute: "2-digit",
        })}
      </td>
      <td className="px-4 py-2">
        <code className="rounded-sm bg-muted px-1.5 py-0.5 font-mono text-[0.72rem]">
          {entry.action}
        </code>
      </td>
      <td className="px-4 py-2 font-mono text-[0.74rem] text-muted-foreground">
        {entry.objectType}·{entry.objectId.slice(-6)}
      </td>
      <td className="px-4 py-2 text-[0.82rem]">
        {entry.actor?.name ?? entry.actor?.email ?? "—"}
      </td>
      <td className="px-4 py-2">
        {entry.workspace ? (
          <span className="font-mono text-[0.68rem] uppercase tracking-[0.12em] text-muted-foreground">
            /{entry.workspace.slug}
          </span>
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </td>
    </tr>
  );
}
