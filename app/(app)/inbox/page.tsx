import Link from "next/link";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { AtSign, Check, Vote } from "lucide-react";
import { markAllNotificationsReadAction, markNotificationReadAction } from "./actions";
import { unreadPl } from "@/lib/pluralize";
import { AppShell } from "@/components/layout/app-shell";

interface MentionPayload {
  commentId?: string;
  taskId?: string;
  workspaceId?: string;
  authorId?: string;
  authorName?: string;
  taskTitle?: string;
  snippet?: string;
}

interface PollCreatedPayload {
  workspaceId?: string;
  taskId?: string;
  taskTitle?: string;
  boardName?: string;
  question?: string;
  authorName?: string | null;
}

async function loadNotifications(userId: string) {
  return db.notification.findMany({
    where: { userId },
    orderBy: [{ readAt: { sort: "asc", nulls: "first" } }, { createdAt: "desc" }],
    take: 200,
  });
}

type NotificationItem = Awaited<ReturnType<typeof loadNotifications>>[number];

export default async function InboxPage() {
  const session = await auth();
  const userId = session!.user.id;

  const notifications = await loadNotifications(userId);

  const unread = notifications.filter((n) => !n.readAt);
  const read = notifications.filter((n) => n.readAt);

  return (
    <AppShell>
      <div className="flex flex-col gap-10">
        <div className="flex items-end justify-between gap-4">
          <div className="flex flex-col gap-2">
            <span className="eyebrow">Powiadomienia</span>
            <h1 className="font-display text-[2.2rem] font-bold leading-[1.1] tracking-[-0.03em]">
              Inbox.{" "}
              <span className="text-brand-gradient">{unread.length}</span>{" "}
              {unreadPl(unread.length)}.
            </h1>
          </div>
          {unread.length > 0 && (
            <form action={markAllNotificationsReadAction}>
              <button
                type="submit"
                className="inline-flex items-center gap-2 rounded-md border border-border px-3 py-2 font-mono text-[0.7rem] uppercase tracking-[0.14em] text-muted-foreground transition-colors hover:border-primary/60 hover:text-foreground"
              >
                <Check size={12} /> Oznacz wszystkie jako przeczytane
              </button>
            </form>
          )}
        </div>

        {unread.length > 0 && (
          <Bucket label="Nieprzeczytane" items={unread} unread />
        )}
        {read.length > 0 && <Bucket label="Przeczytane" items={read} unread={false} />}

        {notifications.length === 0 && (
          <div className="rounded-xl border border-dashed border-border p-10 text-center">
            <p className="font-display text-[1.1rem] font-semibold">Pusto.</p>
            <p className="mt-2 text-[0.92rem] text-muted-foreground">
              Jak ktoś Cię oznaczy w komentarzu albo przypisze do zadania, trafi to tutaj.
            </p>
          </div>
        )}
      </div>
    </AppShell>
  );
}

function Bucket({
  label,
  items,
  unread,
}: {
  label: string;
  items: NotificationItem[];
  unread: boolean;
}) {
  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-baseline gap-3">
        <h2 className={`eyebrow ${unread ? "text-primary" : "text-muted-foreground"}`}>{label}</h2>
        <span className="font-mono text-[0.68rem] uppercase tracking-[0.14em] text-muted-foreground">
          {items.length}
        </span>
      </div>
      <ul className="flex flex-col rounded-xl border border-border bg-card overflow-hidden">
        {items.map((n) => (
          <li key={n.id} className="border-b border-border last:border-b-0">
            <NotificationRow notification={n} unread={unread} />
          </li>
        ))}
      </ul>
    </section>
  );
}

function NotificationRow({
  notification,
  unread,
}: {
  notification: NotificationItem;
  unread: boolean;
}) {
  const isPoll = notification.type === "poll.created";
  const payload = (notification.payload ?? {}) as MentionPayload & PollCreatedPayload;
  const href = payload.workspaceId && payload.taskId
    ? `/w/${payload.workspaceId}/t/${payload.taskId}`
    : "/inbox";

  const body =
    notification.type === "comment.mention" ? (
      <>
        <span className="font-semibold text-foreground">{payload.authorName ?? "Ktoś"}</span>
        {" oznaczył(a) Cię w komentarzu do "}
        <span className="font-semibold text-foreground">{payload.taskTitle ?? "zadania"}</span>.
      </>
    ) : isPoll ? (
      <>
        Na tablicy{" "}
        <span className="font-semibold text-foreground">
          {payload.boardName ?? "?"}
        </span>{" "}
        pojawiło się głosowanie w zadaniu{" "}
        <span className="font-semibold text-foreground">
          {payload.taskTitle ?? "?"}
        </span>
        . <span className="text-primary">Przejdź do głosowania →</span>
      </>
    ) : (
      <span className="text-muted-foreground">{notification.type}</span>
    );

  const snippet =
    notification.type === "comment.mention" && payload.snippet
      ? payload.snippet
      : isPoll && payload.question
        ? payload.question
        : null;

  return (
    <div
      data-unread={unread ? "true" : "false"}
      className="group flex items-center gap-3 px-4 py-3 transition-colors data-[unread=true]:bg-primary/[0.04] hover:bg-accent/60"
    >
      <span
        className={`grid h-8 w-8 shrink-0 place-items-center rounded-full ${
          isPoll ? "bg-amber-500/10 text-amber-500" : "bg-primary/10 text-primary"
        }`}
        aria-hidden
      >
        {isPoll ? <Vote size={14} /> : <AtSign size={14} />}
      </span>
      <Link
        href={href}
        className="flex min-w-0 flex-1 flex-col gap-0.5 focus-visible:outline-none"
      >
        <span className="truncate text-[0.92rem] leading-tight text-muted-foreground group-hover:text-foreground">
          {body}
        </span>
        {snippet && (
          <span className="truncate text-[0.86rem] italic text-muted-foreground/90">
            „{snippet}”
          </span>
        )}
        <span className="font-mono text-[0.64rem] uppercase tracking-[0.12em] text-muted-foreground/80">
          {formatRelative(notification.createdAt)}
        </span>
      </Link>
      {unread && (
        <form action={markNotificationReadAction} className="m-0">
          <input type="hidden" name="id" value={notification.id} />
          <button
            type="submit"
            aria-label="Oznacz jako przeczytane"
            title="Oznacz jako przeczytane"
            className="grid h-7 w-7 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <Check size={13} />
          </button>
        </form>
      )}
    </div>
  );
}

function formatRelative(date: Date): string {
  const then = date.getTime();
  const now = Date.now();
  const diff = Math.round((now - then) / 1000);
  if (diff < 45) return "przed chwilą";
  if (diff < 60 * 60) return `${Math.round(diff / 60)} min temu`;
  if (diff < 60 * 60 * 24) return `${Math.round(diff / 3600)} godz. temu`;
  if (diff < 60 * 60 * 24 * 7) return `${Math.round(diff / 86400)} dni temu`;
  return date.toLocaleDateString("pl-PL", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}
