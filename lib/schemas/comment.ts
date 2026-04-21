import { z } from "zod";

// Shared ProseMirror "doc" shape — Tiptap writes valid nodes, we only
// guard the outer wrapper and cap size.
const richDocSchema = z.object({
  type: z.literal("doc"),
  content: z.array(z.unknown()).optional(),
});

function parseBody(raw: unknown): z.infer<typeof richDocSchema> | null {
  if (typeof raw !== "string" || raw.length === 0) return null;
  try {
    return richDocSchema.parse(JSON.parse(raw));
  } catch {
    return null;
  }
}

function docHasText(doc: z.infer<typeof richDocSchema>): boolean {
  const queue: unknown[] = Array.isArray(doc.content) ? [...doc.content] : [];
  while (queue.length) {
    const node = queue.shift() as { type?: string; text?: string; content?: unknown[] };
    if (node?.type === "text" && typeof node.text === "string" && node.text.trim().length > 0) {
      return true;
    }
    if (Array.isArray(node?.content)) queue.push(...node.content);
  }
  return false;
}

export const createCommentSchema = z.object({
  taskId: z.string().min(1),
  bodyJson: z
    .string()
    .max(50_000, "Komentarz za długi.")
    .transform((raw, ctx) => {
      const doc = parseBody(raw);
      if (!doc || !docHasText(doc)) {
        ctx.addIssue({ code: "custom", message: "Treść wymagana." });
        return z.NEVER;
      }
      return doc;
    }),
});

export const updateCommentSchema = z.object({
  id: z.string().min(1),
  bodyJson: z
    .string()
    .max(50_000, "Komentarz za długi.")
    .transform((raw, ctx) => {
      const doc = parseBody(raw);
      if (!doc || !docHasText(doc)) {
        ctx.addIssue({ code: "custom", message: "Treść wymagana." });
        return z.NEVER;
      }
      return doc;
    }),
});

export const deleteCommentSchema = z.object({
  id: z.string().min(1),
});

export type CreateCommentInput = z.infer<typeof createCommentSchema>;
export type UpdateCommentInput = z.infer<typeof updateCommentSchema>;
