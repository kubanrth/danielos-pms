"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import {
  requireWorkspaceAction,
  requireWorkspaceMembership,
} from "@/lib/workspace-guard";
import { ForbiddenError } from "@/lib/permissions";
import { writeAudit } from "@/lib/audit";
import {
  buildAttachmentKey,
  createSignedDownloadUrl,
  createSignedUploadUrl,
  deleteAttachmentObject,
  isAllowedMime,
  storageObjectExists,
} from "@/lib/storage";
import {
  confirmAttachmentUploadSchema,
  deleteAttachmentSchema,
  requestAttachmentUploadSchema,
} from "@/lib/schemas/attachment";

export type RequestUploadResult =
  | {
      ok: true;
      storageKey: string;
      signedUrl: string;
      token: string;
    }
  | { ok: false; error: string };

// Step 1/2: client calls this with file metadata, gets a short-lived signed
// URL + the storage key it should use on the second call. No DB row yet —
// abandoning the upload leaves no trace.
export async function requestAttachmentUploadAction(input: {
  taskId: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
}): Promise<RequestUploadResult> {
  const parsed = requestAttachmentUploadSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  if (!isAllowedMime(parsed.data.mimeType)) {
    return { ok: false, error: "Nieobsługiwany typ pliku." };
  }

  const task = await db.task.findUnique({ where: { id: parsed.data.taskId } });
  if (!task || task.deletedAt) return { ok: false, error: "Zadanie nie istnieje." };

  await requireWorkspaceAction(task.workspaceId, "task.upload");

  const storageKey = buildAttachmentKey({
    workspaceId: task.workspaceId,
    taskId: task.id,
    filename: parsed.data.filename,
  });

  try {
    const { signedUrl, token } = await createSignedUploadUrl(storageKey);
    return { ok: true, storageKey, signedUrl, token };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Upload URL failed" };
  }
}

export type ConfirmUploadResult =
  | { ok: true; attachmentId: string }
  | { ok: false; error: string };

// Step 2/2: after the browser PUT'd the file to storage, client calls this
// so we persist the Attachment row + audit entry. We verify the object is
// really there before committing so a failed upload can't create a ghost row.
export async function confirmAttachmentUploadAction(input: {
  taskId: string;
  storageKey: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
}): Promise<ConfirmUploadResult> {
  const parsed = confirmAttachmentUploadSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const task = await db.task.findUnique({ where: { id: parsed.data.taskId } });
  if (!task || task.deletedAt) return { ok: false, error: "Zadanie nie istnieje." };

  const ctx = await requireWorkspaceAction(task.workspaceId, "task.upload");

  if (!parsed.data.storageKey.startsWith(`w/${task.workspaceId}/t/${task.id}/`)) {
    // A client sending us a key that isn't scoped to this task means a
    // spoof attempt — reject without hitting storage.
    return { ok: false, error: "Nieprawidłowy klucz pliku." };
  }

  const exists = await storageObjectExists(parsed.data.storageKey);
  if (!exists) return { ok: false, error: "Plik nie został wgrany." };

  const attachment = await db.attachment.create({
    data: {
      taskId: task.id,
      uploaderId: ctx.userId,
      filename: parsed.data.filename,
      mimeType: parsed.data.mimeType,
      sizeBytes: parsed.data.sizeBytes,
      storageKey: parsed.data.storageKey,
    },
  });

  await writeAudit({
    workspaceId: task.workspaceId,
    objectType: "Task",
    objectId: task.id,
    actorId: ctx.userId,
    action: "attachment.created",
    diff: {
      attachmentId: attachment.id,
      filename: attachment.filename,
      sizeBytes: attachment.sizeBytes,
    },
  });

  revalidatePath(`/w/${task.workspaceId}/t/${task.id}`);
  return { ok: true, attachmentId: attachment.id };
}

export type DownloadUrlResult =
  | { ok: true; url: string; filename: string }
  | { ok: false; error: string };

// Click-to-download: mint a fresh 15-minute signed URL each time so links
// emailed/copied can't outlive the session that spawned them. Scoped by
// attachment id so RBAC lives here (not in the URL signer).
export async function getAttachmentDownloadUrlAction(input: {
  id: string;
}): Promise<DownloadUrlResult> {
  const existing = await db.attachment.findUnique({
    where: { id: input.id },
    include: { task: { select: { id: true, workspaceId: true } } },
  });
  if (!existing || existing.deletedAt) return { ok: false, error: "Plik nie istnieje." };

  await requireWorkspaceMembership(existing.task.workspaceId);

  try {
    const url = await createSignedDownloadUrl(existing.storageKey);
    return { ok: true, url, filename: existing.filename };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Download URL failed" };
  }
}

export async function deleteAttachmentAction(formData: FormData) {
  const parsed = deleteAttachmentSchema.safeParse({ id: formData.get("id") });
  if (!parsed.success) return;

  const existing = await db.attachment.findUnique({
    where: { id: parsed.data.id },
    include: { task: { select: { id: true, workspaceId: true } } },
  });
  if (!existing || existing.deletedAt) return;

  const ctx = await requireWorkspaceMembership(existing.task.workspaceId);
  const canAct = existing.uploaderId === ctx.userId || ctx.role === "ADMIN";
  if (!canAct) throw new ForbiddenError("task.upload");

  await db.attachment.update({
    where: { id: existing.id },
    data: { deletedAt: new Date() },
  });

  // Storage object is removed best-effort. If it fails, the row is still
  // soft-deleted — a cron/cleanup can re-try later. Never throw here: a
  // successful DB update matters more than a tidy bucket.
  try {
    await deleteAttachmentObject(existing.storageKey);
  } catch {
    /* swallow — leaves an orphan in storage, not user-visible */
  }

  await writeAudit({
    workspaceId: existing.task.workspaceId,
    objectType: "Task",
    objectId: existing.task.id,
    actorId: ctx.userId,
    action: "attachment.deleted",
    diff: { attachmentId: existing.id, filename: existing.filename },
  });

  revalidatePath(`/w/${existing.task.workspaceId}/t/${existing.task.id}`);
}
