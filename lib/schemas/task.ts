import { z } from "zod";

export const createTaskSchema = z.object({
  workspaceId: z.string().min(1),
  boardId: z.string().min(1),
  title: z.string().trim().min(1, "Tytuł jest wymagany.").max(200),
});

// Loose ProseMirror doc shape. We don't deeply validate content nodes —
// Tiptap renders only known nodes and drops unknowns, so the runtime
// editor is our sanitizer. We DO cap the serialized size (50KB) to keep
// pathological blobs out of Postgres jsonb.
const richDocSchema = z.object({
  type: z.literal("doc"),
  content: z.array(z.unknown()).optional(),
});

export const updateTaskSchema = z.object({
  id: z.string().min(1),
  title: z.string().trim().min(1, "Tytuł jest wymagany.").max(200),
  // Empty string means "no description"; otherwise a JSON-stringified
  // ProseMirror doc emitted by the RichTextEditor's hidden input.
  descriptionJson: z
    .string()
    .max(50_000, "Opis za długi.")
    .optional()
    .or(z.literal(""))
    .transform((raw) => {
      if (!raw) return null;
      try {
        const parsed = JSON.parse(raw);
        return richDocSchema.parse(parsed);
      } catch {
        return null;
      }
    }),
  statusColumnId: z.string().min(1).optional().or(z.literal("")),
  startAt: z.string().optional().or(z.literal("")),
  stopAt: z.string().optional().or(z.literal("")),
  // Resolved offset to the absolute reminder timestamp; empty = clear.
  // Values: "none" | "1h" | "1d" | "3d" | ISO datetime (custom).
  reminderOffset: z.string().optional().or(z.literal("")),
});

export const toggleAssigneeSchema = z.object({
  taskId: z.string().min(1),
  userId: z.string().min(1),
});

export const toggleTagSchema = z.object({
  taskId: z.string().min(1),
  tagId: z.string().min(1),
});

export const createTagSchema = z.object({
  workspaceId: z.string().min(1),
  name: z.string().trim().min(1, "Nazwa tagu wymagana.").max(32),
  colorHex: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/, "Podaj kolor w formacie #RRGGBB."),
});

export type CreateTaskInput = z.infer<typeof createTaskSchema>;
export type UpdateTaskInput = z.infer<typeof updateTaskSchema>;
