"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { ViewType } from "@/lib/generated/prisma/enums";
import { requireWorkspaceAction } from "@/lib/workspace-guard";
import { writeAudit } from "@/lib/audit";
import { parseEnabledViews, viewTypeToName } from "@/components/view/view-switcher";

const createBoardSchema = z.object({
  workspaceId: z.string().min(1),
  name: z.string().trim().min(1, "Nazwa jest wymagana").max(80),
  description: z.string().trim().max(280).optional(),
});

export type CreateBoardState =
  | { ok: true; boardId: string }
  | { ok: false; error?: string; fieldErrors?: { name?: string; description?: string } }
  | null;

// Seeds the new board with the same status columns as the default board
// and BoardView rows matching workspace.enabledViews (minus WHITEBOARD,
// which lives in ProcessCanvas and is created on-demand).
export async function createBoardAction(
  _prev: CreateBoardState,
  formData: FormData,
): Promise<CreateBoardState> {
  const parsed = createBoardSchema.safeParse({
    workspaceId: formData.get("workspaceId"),
    name: formData.get("name"),
    description: formData.get("description") || undefined,
  });
  if (!parsed.success) {
    const fe: { name?: string; description?: string } = {};
    for (const issue of parsed.error.issues) {
      const k = issue.path[0];
      if (k === "name" || k === "description") fe[k] = issue.message;
    }
    return { ok: false, fieldErrors: fe };
  }

  const ctx = await requireWorkspaceAction(parsed.data.workspaceId, "board.create");

  const ws = await db.workspace.findUnique({
    where: { id: parsed.data.workspaceId },
    select: { enabledViews: true },
  });
  if (!ws) return { ok: false, error: "Workspace nie istnieje." };

  const enabledViews = parseEnabledViews(ws.enabledViews);
  const boardViewTypes: ViewType[] = [];
  for (const v of enabledViews) {
    if (v === "whiteboard") continue;
    boardViewTypes.push(v.toUpperCase() as ViewType);
  }

  const board = await db.board.create({
    data: {
      workspaceId: parsed.data.workspaceId,
      name: parsed.data.name,
      description: parsed.data.description ?? null,
      creatorId: ctx.userId,
      statusColumns: {
        create: [
          { name: "Do zrobienia", colorHex: "#64748B", order: 0 },
          { name: "W trakcie", colorHex: "#F59E0B", order: 1 },
          { name: "Testy", colorHex: "#3B82F6", order: 2 },
          { name: "Done", colorHex: "#10B981", order: 3 },
        ],
      },
      views: {
        create: boardViewTypes.map((type) => ({ type })),
      },
    },
  });

  await writeAudit({
    workspaceId: parsed.data.workspaceId,
    objectType: "Board",
    objectId: board.id,
    actorId: ctx.userId,
    action: "board.created",
    diff: { name: board.name },
  });

  revalidatePath(`/w/${parsed.data.workspaceId}`);
  revalidatePath("/workspaces");
  // Pick the first enabled non-whiteboard view for the landing URL.
  const firstView = viewTypeToName(boardViewTypes[0] ?? "TABLE") ?? "table";
  redirect(`/w/${parsed.data.workspaceId}/b/${board.id}/${firstView}`);
}
