import { z } from "zod";

export const requestAttachmentUploadSchema = z.object({
  taskId: z.string().min(1),
  filename: z.string().trim().min(1).max(240),
  mimeType: z.string().min(1).max(200),
  sizeBytes: z.number().int().positive().max(25 * 1024 * 1024),
});

export const confirmAttachmentUploadSchema = z.object({
  taskId: z.string().min(1),
  storageKey: z.string().min(1),
  filename: z.string().trim().min(1).max(240),
  mimeType: z.string().min(1).max(200),
  sizeBytes: z.number().int().positive().max(25 * 1024 * 1024),
});

export const deleteAttachmentSchema = z.object({
  id: z.string().min(1),
});

export type RequestAttachmentUploadInput = z.infer<typeof requestAttachmentUploadSchema>;
export type ConfirmAttachmentUploadInput = z.infer<typeof confirmAttachmentUploadSchema>;
