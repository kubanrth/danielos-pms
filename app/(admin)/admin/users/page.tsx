import { db } from "@/lib/db";
import { requireSuperAdmin } from "@/lib/admin-guard";
import { Ban, Check, ShieldCheck, Trash2, UserCheck } from "lucide-react";
import {
  softDeleteUserAction,
  toggleUserBanAction,
} from "@/app/(admin)/admin/actions";

// Small helper so the columns don't balloon with Prisma types.
async function loadUsers(query: string) {
  return db.user.findMany({
    where: query
      ? {
          OR: [
            { email: { contains: query, mode: "insensitive" } },
            { name: { contains: query, mode: "insensitive" } },
          ],
        }
      : undefined,
    orderBy: { createdAt: "desc" },
    take: 200,
    include: {
      _count: {
        select: {
          memberships: { where: { workspace: { deletedAt: null } } },
        },
      },
    },
  });
}

type UserRow = Awaited<ReturnType<typeof loadUsers>>[number];

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const admin = await requireSuperAdmin();
  const { q } = await searchParams;
  const query = (q ?? "").trim();
  const users = await loadUsers(query);

  return (
    <main className="flex-1 px-8 py-10 md:px-14 md:py-14">
      <div className="mx-auto flex max-w-6xl flex-col gap-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="flex flex-col gap-2">
            <span className="eyebrow">Użytkownicy</span>
            <h1 className="font-display text-[2rem] font-bold leading-[1.1] tracking-[-0.03em]">
              {users.length} {users.length === 1 ? "konto" : "kont"}
            </h1>
          </div>
          <form action="/admin/users" className="flex items-center gap-2">
            <input
              name="q"
              type="search"
              defaultValue={query}
              placeholder="szukaj po email / imię…"
              className="h-9 w-[260px] rounded-md border border-border bg-card px-3 text-[0.88rem] outline-none focus:border-primary"
            />
            <button
              type="submit"
              className="inline-flex h-9 items-center rounded-md border border-border bg-card px-3 font-mono text-[0.7rem] uppercase tracking-[0.14em] text-muted-foreground transition-colors hover:text-foreground"
            >
              Szukaj
            </button>
          </form>
        </div>

        <div className="overflow-hidden rounded-xl border border-border bg-card">
          <table className="w-full text-left">
            <thead className="border-b border-border bg-muted/50">
              <tr className="font-mono text-[0.62rem] uppercase tracking-[0.14em] text-muted-foreground">
                <th className="px-4 py-2">Użytkownik</th>
                <th className="px-4 py-2">Rola</th>
                <th className="px-4 py-2">Przestrzenie</th>
                <th className="px-4 py-2">Ostatnio</th>
                <th className="px-4 py-2">Status</th>
                <th className="px-4 py-2 text-right">Akcje</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <UserRow key={u.id} user={u} isSelf={u.id === admin.userId} />
              ))}
            </tbody>
          </table>
          {users.length === 0 && (
            <p className="px-4 py-8 text-center text-[0.88rem] text-muted-foreground">
              {query ? "Brak dopasowań." : "Brak użytkowników."}
            </p>
          )}
        </div>
      </div>
    </main>
  );
}

function UserRow({ user, isSelf }: { user: UserRow; isSelf: boolean }) {
  const initials = (user.name ?? user.email).slice(0, 2).toUpperCase();
  const isDeleted = !!user.deletedAt;

  return (
    <tr
      data-deleted={isDeleted ? "true" : "false"}
      className="border-b border-border last:border-b-0 data-[deleted=true]:opacity-60"
    >
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          <span className="grid h-8 w-8 shrink-0 place-items-center overflow-hidden rounded-full bg-brand-gradient font-display text-[0.68rem] font-bold text-white">
            {user.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={user.avatarUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              initials
            )}
          </span>
          <div className="flex min-w-0 flex-col">
            <span className="truncate text-[0.88rem] font-medium">
              {user.name ?? user.email.split("@")[0]}
            </span>
            <span className="truncate font-mono text-[0.64rem] uppercase tracking-[0.12em] text-muted-foreground">
              {user.email}
            </span>
          </div>
        </div>
      </td>
      <td className="px-4 py-3">
        {user.isSuperAdmin ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 font-mono text-[0.62rem] uppercase tracking-[0.14em] text-primary">
            <ShieldCheck size={10} /> Super admin
          </span>
        ) : (
          <span className="font-mono text-[0.64rem] uppercase tracking-[0.14em] text-muted-foreground">
            Member
          </span>
        )}
      </td>
      <td className="px-4 py-3 font-mono text-[0.78rem]">{user._count.memberships}</td>
      <td className="px-4 py-3 font-mono text-[0.7rem] uppercase tracking-[0.12em] text-muted-foreground">
        {user.lastSeenAt ? formatAgo(user.lastSeenAt) : "—"}
      </td>
      <td className="px-4 py-3">
        {isDeleted ? (
          <span className="inline-flex items-center gap-1 font-mono text-[0.62rem] uppercase tracking-[0.14em] text-destructive">
            <Trash2 size={10} /> Usunięty
          </span>
        ) : user.isBanned ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-destructive/10 px-2 py-0.5 font-mono text-[0.62rem] uppercase tracking-[0.14em] text-destructive">
            <Ban size={10} /> Zbanowany
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 font-mono text-[0.62rem] uppercase tracking-[0.14em] text-muted-foreground">
            <Check size={10} /> Aktywny
          </span>
        )}
      </td>
      <td className="px-4 py-3">
        {isSelf ? (
          <span className="block text-right font-mono text-[0.62rem] uppercase tracking-[0.14em] text-muted-foreground">
            to Ty
          </span>
        ) : (
          <div className="flex items-center justify-end gap-1">
            {!isDeleted && (
              <form action={toggleUserBanAction} className="m-0">
                <input type="hidden" name="id" value={user.id} />
                <button
                  type="submit"
                  className="grid h-7 w-7 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                  aria-label={user.isBanned ? "Odbanuj" : "Zbanuj"}
                  title={user.isBanned ? "Odbanuj" : "Zbanuj"}
                >
                  {user.isBanned ? <UserCheck size={13} /> : <Ban size={13} />}
                </button>
              </form>
            )}
            {!isDeleted && (
              <form action={softDeleteUserAction} className="m-0">
                <input type="hidden" name="id" value={user.id} />
                <button
                  type="submit"
                  className="grid h-7 w-7 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                  aria-label="Usuń"
                  title="Usuń"
                >
                  <Trash2 size={13} />
                </button>
              </form>
            )}
          </div>
        )}
      </td>
    </tr>
  );
}

function formatAgo(date: Date): string {
  const diff = Math.round((Date.now() - date.getTime()) / 1000);
  if (diff < 60) return "przed chwilą";
  if (diff < 3600) return `${Math.round(diff / 60)} min temu`;
  if (diff < 86400) return `${Math.round(diff / 3600)} h temu`;
  if (diff < 86400 * 30) return `${Math.round(diff / 86400)} d temu`;
  return date.toLocaleDateString("pl-PL");
}
