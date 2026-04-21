import { z } from "zod";

export const createTaskSchema = z.object({
  workspaceId: z.string().min(1),
  boardId: z.string().min(1),
  title: z.string().trim().min(1, "Tytuł jest wymagany.").max(200),
});

export const updateTaskSchema = z.object({
  id: z.string().min(1),
  title: z.string().trim().min(1, "Tytuł jest wymagany.").max(200),
  description: z.string().trim().max(5000).optional().or(z.literal("")),
  statusColumnId: z.string().min(1).optional().or(z.literal("")),
  startAt: z.string().optional().or(z.literal("")),
  stopAt: z.string().optional().or(z.literal("")),
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
