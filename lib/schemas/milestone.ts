import { z } from "zod";

// Same loose ProseMirror wrapper used by tasks/comments. Tiptap is the
// sanitizer; we just cap size and confirm the outer shape.
const richDocSchema = z.object({
  type: z.literal("doc"),
  content: z.array(z.unknown()).optional(),
});

function parseDescription(raw: unknown): z.infer<typeof richDocSchema> | null {
  if (typeof raw !== "string" || raw.length === 0) return null;
  try {
    return richDocSchema.parse(JSON.parse(raw));
  } catch {
    return null;
  }
}

function isoDate(fieldLabel: string) {
  return z
    .string()
    .min(1, `${fieldLabel} wymagane.`)
    .refine((v) => !Number.isNaN(new Date(v).getTime()), `${fieldLabel} niepoprawna.`);
}

const milestoneBaseShape = {
  workspaceId: z.string().min(1),
  boardId: z.string().min(1),
  title: z.string().trim().min(1, "Tytuł wymagany.").max(200),
  descriptionJson: z
    .string()
    .max(50_000, "Opis za długi.")
    .optional()
    .or(z.literal(""))
    .transform((raw) => (raw ? parseDescription(raw) : null)),
  assigneeId: z.string().min(1).optional().or(z.literal("")),
  startAt: isoDate("Data startu"),
  stopAt: isoDate("Data końca"),
};

const dateOrder = (v: { startAt: string; stopAt: string }) =>
  new Date(v.startAt).getTime() <= new Date(v.stopAt).getTime();

export const createMilestoneSchema = z
  .object(milestoneBaseShape)
  .refine(dateOrder, {
    message: "Data końca nie może być wcześniejsza niż startu.",
    path: ["stopAt"],
  });

export const updateMilestoneSchema = z
  .object({ ...milestoneBaseShape, id: z.string().min(1) })
  .refine(dateOrder, {
    message: "Data końca nie może być wcześniejsza niż startu.",
    path: ["stopAt"],
  });

export const deleteMilestoneSchema = z.object({ id: z.string().min(1) });

export const assignTaskToMilestoneSchema = z.object({
  taskId: z.string().min(1),
  // Empty string clears the assignment.
  milestoneId: z.string().optional().or(z.literal("")),
});

export type CreateMilestoneInput = z.infer<typeof createMilestoneSchema>;
export type UpdateMilestoneInput = z.infer<typeof updateMilestoneSchema>;
