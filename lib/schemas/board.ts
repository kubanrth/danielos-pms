import { z } from "zod";

export const renameBoardSchema = z.object({
  id: z.string().min(1),
  name: z.string().trim().min(1, "Nazwa wymagana.").max(80),
  description: z.string().trim().max(280).optional().or(z.literal("")),
});

export const createStatusColumnSchema = z.object({
  boardId: z.string().min(1),
  name: z.string().trim().min(1, "Nazwa wymagana.").max(40),
  colorHex: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/)
    .default("#64748B"),
});

export const updateStatusColumnSchema = z.object({
  columnId: z.string().min(1),
  name: z.string().trim().min(1).max(40),
  colorHex: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
});

export const deleteStatusColumnSchema = z.object({
  columnId: z.string().min(1),
});

export const reorderStatusColumnsSchema = z.object({
  boardId: z.string().min(1),
  ids: z.array(z.string().min(1)).min(1),
});
