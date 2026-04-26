import { NextResponse } from "next/server";
import { db } from "@/lib/db";

// F11-17 (#24): Vercel Cron hits this once a day. For every task with
// `recurrenceRule` set, decide whether today matches the rule and a
// fresh instance hasn't been spawned yet. If yes — clone the template
// (title + description + status column + assignees + tags) into a new
// Task with `recurrenceParentId` pointing back. Bumps the template's
// `recurrenceLastSpawnAt` so we don't double-spawn within the same UTC
// day.

interface RecurrenceRule {
  freq: "daily" | "weekly" | "monthly";
  day?: number;
}

function shouldSpawn(rule: RecurrenceRule, now: Date): boolean {
  if (rule.freq === "daily") return true;
  if (rule.freq === "weekly") {
    if (typeof rule.day !== "number") return false;
    // 0 = Sunday … 6 = Saturday (matches getDay).
    return now.getDay() === rule.day;
  }
  if (rule.freq === "monthly") {
    if (typeof rule.day !== "number") return false;
    // Clamp to last day of month so day=31 fires on Feb 28/29.
    const lastDayOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const fireDay = Math.min(rule.day, lastDayOfMonth);
    return now.getDate() === fireDay;
  }
  return false;
}

function isSameUtcDay(a: Date, b: Date): boolean {
  return (
    a.getUTCFullYear() === b.getUTCFullYear() &&
    a.getUTCMonth() === b.getUTCMonth() &&
    a.getUTCDate() === b.getUTCDate()
  );
}

async function runSweep(now: Date) {
  // Pull every active template. We expect this to be a small set
  // (templates are rare); per-day full scan is fine.
  const templates = await db.task.findMany({
    where: {
      recurrenceRule: { not: { equals: null } },
      deletedAt: null,
    },
    take: 1000,
    include: {
      assignees: { select: { userId: true } },
      tags: { select: { tagId: true } },
    },
  });

  let spawned = 0;
  const skipped: string[] = [];

  for (const t of templates) {
    const rule = t.recurrenceRule as unknown;
    if (!rule || typeof rule !== "object") {
      skipped.push(`${t.id}: invalid rule`);
      continue;
    }
    if (!shouldSpawn(rule as RecurrenceRule, now)) continue;
    if (t.recurrenceLastSpawnAt && isSameUtcDay(t.recurrenceLastSpawnAt, now)) continue;

    // Compute new rowOrder = last+1 in same column.
    const last = t.statusColumnId
      ? await db.task.findFirst({
          where: { statusColumnId: t.statusColumnId, deletedAt: null },
          orderBy: { rowOrder: "desc" },
          select: { rowOrder: true },
        })
      : null;

    const instance = await db.task.create({
      data: {
        workspaceId: t.workspaceId,
        boardId: t.boardId,
        statusColumnId: t.statusColumnId,
        creatorId: t.creatorId,
        title: t.title,
        descriptionJson: t.descriptionJson ?? undefined,
        rowOrder: (last?.rowOrder ?? 0) + 1,
        recurrenceParentId: t.id,
      },
    });

    // Copy assignees + tags so the instance lands ready for work.
    if (t.assignees.length > 0) {
      await db.taskAssignee.createMany({
        data: t.assignees.map((a) => ({ taskId: instance.id, userId: a.userId })),
        skipDuplicates: true,
      });
    }
    if (t.tags.length > 0) {
      await db.taskTag.createMany({
        data: t.tags.map((tg) => ({ taskId: instance.id, tagId: tg.tagId })),
        skipDuplicates: true,
      });
    }

    await db.task.update({
      where: { id: t.id },
      data: { recurrenceLastSpawnAt: now },
    });
    spawned++;
  }

  return { templates: templates.length, spawned, skipped };
}

function authorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const auth = req.headers.get("authorization") ?? "";
  return auth === `Bearer ${secret}`;
}

export async function GET(req: Request) {
  if (!authorized(req)) return new NextResponse("Unauthorized", { status: 401 });
  try {
    const result = await runSweep(new Date());
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}
