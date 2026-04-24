import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  CalendarMonthGrid,
  type CalendarEvent,
} from "@/components/my/calendar/month-grid";

export default async function MyCalendarPage() {
  const session = await auth();
  if (!session?.user) redirect("/secure-access-portal");
  const userId = session.user.id;

  // Fetch every assignment that has at least one date — we still need the
  // task row for title, workspace, and status color.
  const assignments = await db.taskAssignee.findMany({
    where: {
      userId,
      task: {
        deletedAt: null,
        OR: [{ startAt: { not: null } }, { stopAt: { not: null } }],
      },
    },
    include: {
      task: {
        include: {
          workspace: { select: { id: true, name: true } },
          board: { select: { name: true } },
          statusColumn: { select: { colorHex: true } },
        },
      },
    },
  });

  const events: CalendarEvent[] = assignments.map((a) => ({
    id: a.task.id,
    title: a.task.title,
    workspaceId: a.task.workspace.id,
    workspaceName: a.task.workspace.name,
    boardName: a.task.board.name,
    statusColor: a.task.statusColumn?.colorHex ?? null,
    startAt: a.task.startAt ? a.task.startAt.toISOString() : null,
    stopAt: a.task.stopAt ? a.task.stopAt.toISOString() : null,
  }));

  return (
    <main className="flex-1 px-8 py-10 md:px-14 md:py-14">
      <div className="mx-auto max-w-6xl">
        <div className="mb-8 flex flex-col gap-2">
          <span className="eyebrow">Twój kalendarz</span>
          <h1 className="font-display text-[2.2rem] font-bold leading-[1.1] tracking-[-0.03em]">
            Co masz <span className="text-brand-gradient">na osi</span>.
          </h1>
          <p className="max-w-[60ch] text-[0.95rem] leading-[1.55] text-muted-foreground">
            Wszystkie zadania, w których jesteś assignee, na siatce miesiąca.
            Klik = otwarcie karty zadania.
          </p>
        </div>

        <CalendarMonthGrid events={events} />
      </div>
    </main>
  );
}
