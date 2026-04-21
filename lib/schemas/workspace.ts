import { z } from "zod";

export const workspaceNameSchema = z
  .string()
  .trim()
  .min(2, "Nazwa musi mieć co najmniej 2 znaki.")
  .max(60, "Nazwa nie może być dłuższa niż 60 znaków.");

export const workspaceDescriptionSchema = z
  .string()
  .trim()
  .max(280, "Opis może mieć maksymalnie 280 znaków.")
  .optional()
  .or(z.literal(""));

export const createWorkspaceSchema = z.object({
  name: workspaceNameSchema,
  description: workspaceDescriptionSchema,
});

export const updateWorkspaceSchema = z.object({
  id: z.string().min(1),
  name: workspaceNameSchema,
  description: workspaceDescriptionSchema,
});

export const deleteWorkspaceSchema = z.object({
  id: z.string().min(1),
  confirmName: z.string().min(1),
});

export type CreateWorkspaceInput = z.infer<typeof createWorkspaceSchema>;
export type UpdateWorkspaceInput = z.infer<typeof updateWorkspaceSchema>;

// Convert a human-readable name into a URL-safe slug.
// E.g. "Marketing — Q3 2026!" → "marketing-q3-2026".
export function slugify(raw: string): string {
  return raw
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // strip diacritics
    .replace(/[^a-z0-9]+/g, "-") // non-alphanumerics → dash
    .replace(/^-+|-+$/g, "") // trim dashes
    .slice(0, 40);
}
