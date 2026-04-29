"use server";

// F12-K40: per-task time tracking — start / pause / complete. Klient:
// 'do każdego zadania muszę dodać start/stop'. Trzy stany:
//   - Idle:      timerStartedAt=null, timerCompletedAt=null
//   - Running:   timerStartedAt set
//   - Completed: timerCompletedAt set (lock — Reset to reopen, ale
//                tego nie zrobiłem na MVP — klient tego nie prosił)
//
// Permission: task.update — analogicznie do reszty mutacji w t/actions.ts.

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireWorkspaceAction } from "@/lib/workspace-guard";
import { writeAudit } from "@/lib/audit";
import { broadcastWorkspaceChange } from "@/lib/realtime";

const timerSchema = z.object({ id: z.string().min(1) });

async function loadTaskForTimer(id: string) {
  return db.task.findUnique({
    where: { id },
    select: {
      id: true,
      workspaceId: true,
      timeTrackedSeconds: true,
      timerStartedAt: true,
      timerCompletedAt: true,
    },
  });
}

// F12-K40: idempotent — gdy timer już chodzi, nic nie robi (drugie
// kliknięcie 'Rozpocznij' nie podwoi czasu).
export async function startTaskTimerAction(formData: FormData) {
  const parsed = timerSchema.safeParse({ id: formData.get("id") });
  if (!parsed.success) return;

  const task = await loadTaskForTimer(parsed.data.id);
  if (!task) return;
  const ctx = await requireWorkspaceAction(task.workspaceId, "task.update");

  // Już zakończone albo już chodzi → noop.
  if (task.timerCompletedAt) return;
  if (task.timerStartedAt) return;

  await db.task.update({
    where: { id: task.id },
    data: { timerStartedAt: new Date() },
  });
  await writeAudit({
    workspaceId: task.workspaceId,
    objectType: "Task",
    objectId: task.id,
    actorId: ctx.userId,
    action: "task.timerStarted",
  });
  await broadcastWorkspaceChange(task.workspaceId, {
    type: "task.changed",
    taskId: task.id,
  });
  revalidatePath(`/w/${task.workspaceId}/t/${task.id}`);
}

// F12-K40: pause = dodaj elapsed do akumulatora + wyzeruj timerStartedAt.
// Po pauzie ten sam Task wraca do stanu Idle z accumulated > 0; user
// może 'Rozpocznij' znowu i akumulator dalej rośnie.
export async function pauseTaskTimerAction(formData: FormData) {
  const parsed = timerSchema.safeParse({ id: formData.get("id") });
  if (!parsed.success) return;

  const task = await loadTaskForTimer(parsed.data.id);
  if (!task) return;
  const ctx = await requireWorkspaceAction(task.workspaceId, "task.update");

  // Nie chodzi → noop.
  if (!task.timerStartedAt) return;
  if (task.timerCompletedAt) return;

  const elapsed = Math.floor(
    (Date.now() - task.timerStartedAt.getTime()) / 1000,
  );
  await db.task.update({
    where: { id: task.id },
    data: {
      timeTrackedSeconds: { increment: Math.max(0, elapsed) },
      timerStartedAt: null,
    },
  });
  await writeAudit({
    workspaceId: task.workspaceId,
    objectType: "Task",
    objectId: task.id,
    actorId: ctx.userId,
    action: "task.timerPaused",
    diff: { sessionSeconds: elapsed },
  });
  await broadcastWorkspaceChange(task.workspaceId, {
    type: "task.changed",
    taskId: task.id,
  });
  revalidatePath(`/w/${task.workspaceId}/t/${task.id}`);
}

// F12-K40: complete = jeśli running → zliczamy elapsed do akumulatora,
// potem locked. Po Zakończ user nie ma już przycisków (timer zamrożony).
export async function completeTaskTimerAction(formData: FormData) {
  const parsed = timerSchema.safeParse({ id: formData.get("id") });
  if (!parsed.success) return;

  const task = await loadTaskForTimer(parsed.data.id);
  if (!task) return;
  const ctx = await requireWorkspaceAction(task.workspaceId, "task.update");

  // Już zakończone → noop.
  if (task.timerCompletedAt) return;

  const now = new Date();
  const extraSeconds = task.timerStartedAt
    ? Math.max(0, Math.floor((now.getTime() - task.timerStartedAt.getTime()) / 1000))
    : 0;

  await db.task.update({
    where: { id: task.id },
    data: {
      timeTrackedSeconds: task.timeTrackedSeconds + extraSeconds,
      timerStartedAt: null,
      timerCompletedAt: now,
    },
  });
  await writeAudit({
    workspaceId: task.workspaceId,
    objectType: "Task",
    objectId: task.id,
    actorId: ctx.userId,
    action: "task.timerCompleted",
    diff: { totalSeconds: task.timeTrackedSeconds + extraSeconds },
  });
  await broadcastWorkspaceChange(task.workspaceId, {
    type: "task.changed",
    taskId: task.id,
  });
  revalidatePath(`/w/${task.workspaceId}/t/${task.id}`);
}
