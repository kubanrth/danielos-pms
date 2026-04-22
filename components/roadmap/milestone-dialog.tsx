"use client";

import { useActionState, startTransition, useEffect, useState } from "react";
import { X } from "lucide-react";
import { Dialog as BaseDialog } from "@base-ui/react/dialog";
import {
  createMilestoneAction,
  updateMilestoneAction,
  type CreateMilestoneState,
  type UpdateMilestoneState,
} from "@/app/(app)/w/[workspaceId]/b/[boardId]/milestone-actions";
import { RichTextEditor } from "@/components/task/rich-text-editor";
import { DateTimePicker } from "@/components/ui/date-time-picker";

export interface MilestoneMember {
  id: string;
  name: string | null;
  email: string;
  avatarUrl: string | null;
}

interface InitialMilestone {
  id: string;
  title: string;
  startAt: string;
  stopAt: string;
  assignee: MilestoneMember | null;
}

type Mode = "create" | "edit";

export function MilestoneDialog({
  workspaceId,
  boardId,
  members,
  mode,
  initial,
  onClose,
}: {
  workspaceId: string;
  boardId: string;
  members: MilestoneMember[];
  mode: Mode;
  initial: InitialMilestone | null;
  onClose: () => void;
}) {
  const isEdit = mode === "edit" && initial != null;

  const [createState, createAction, creating] = useActionState<CreateMilestoneState, FormData>(
    createMilestoneAction,
    null,
  );
  const [updateState, updateAction, updating] = useActionState<UpdateMilestoneState, FormData>(
    updateMilestoneAction,
    null,
  );

  const state = isEdit ? updateState : createState;
  const pending = isEdit ? updating : creating;
  const fieldErrors = !state?.ok ? state?.fieldErrors : undefined;

  // Close after a successful submit.
  useEffect(() => {
    if (state?.ok) onClose();
  }, [state, onClose]);

  // Default: new milestone spans today → +14 days. Captured once at mount
  // so dialog re-renders don't shift the defaults mid-interaction.
  const [defaults] = useState(() => {
    const now = Date.now();
    return {
      start: new Date(now).toISOString(),
      stop: new Date(now + 14 * 24 * 60 * 60 * 1000).toISOString(),
    };
  });
  const defaultStart = initial?.startAt ?? defaults.start;
  const defaultStop = initial?.stopAt ?? defaults.stop;

  return (
    <BaseDialog.Root open onOpenChange={(open) => !open && onClose()}>
      <BaseDialog.Portal>
        <BaseDialog.Backdrop className="fixed inset-0 z-40 bg-background/70 backdrop-blur-sm" />
        <BaseDialog.Popup className="fixed left-1/2 top-1/2 z-50 flex max-h-[90vh] w-[min(560px,92vw)] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-xl border border-border bg-background shadow-[0_24px_48px_-12px_rgba(0,0,0,0.25)]">
          <div className="flex items-center justify-between border-b border-border px-6 py-3">
            <BaseDialog.Title className="eyebrow">
              {isEdit ? "Edytuj milestone" : "Nowy milestone"}
            </BaseDialog.Title>
            <button
              type="button"
              onClick={onClose}
              className="grid h-8 w-8 place-items-center rounded-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              aria-label="Zamknij"
            >
              <X size={16} />
            </button>
          </div>

          <form
            action={(fd) => startTransition(() => (isEdit ? updateAction(fd) : createAction(fd)))}
            className="flex max-h-full flex-col gap-5 overflow-y-auto px-6 py-6"
          >
            <input type="hidden" name="workspaceId" value={workspaceId} />
            <input type="hidden" name="boardId" value={boardId} />
            {isEdit && initial && <input type="hidden" name="id" value={initial.id} />}

            <label className="flex flex-col gap-2">
              <span className="eyebrow">Tytuł</span>
              <input
                name="title"
                type="text"
                required
                maxLength={200}
                defaultValue={initial?.title ?? ""}
                autoFocus
                aria-invalid={!!fieldErrors?.title}
                className="border-b border-border bg-transparent pb-2 font-display text-[1.4rem] leading-[1.2] tracking-[-0.02em] outline-none focus:border-primary aria-[invalid=true]:border-destructive"
              />
              {fieldErrors?.title && (
                <span className="font-mono text-[0.68rem] text-destructive">
                  {fieldErrors.title}
                </span>
              )}
            </label>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="flex flex-col gap-2">
                <span className="eyebrow">Start</span>
                <DateTimePicker
                  name="startAt"
                  defaultValue={defaultStart}
                  placeholder="Wybierz start"
                  label="Data startu"
                />
                {fieldErrors?.startAt && (
                  <span className="font-mono text-[0.68rem] text-destructive">
                    {fieldErrors.startAt}
                  </span>
                )}
              </div>
              <div className="flex flex-col gap-2">
                <span className="eyebrow">Koniec</span>
                <DateTimePicker
                  name="stopAt"
                  defaultValue={defaultStop}
                  placeholder="Wybierz koniec"
                  label="Data końca"
                />
                {fieldErrors?.stopAt && (
                  <span className="font-mono text-[0.68rem] text-destructive">
                    {fieldErrors.stopAt}
                  </span>
                )}
              </div>
            </div>

            <label className="flex flex-col gap-2">
              <span className="eyebrow">Assignee</span>
              <select
                name="assigneeId"
                defaultValue={initial?.assignee?.id ?? ""}
                className="h-10 appearance-none border-b border-border bg-transparent pb-1 font-mono text-[0.82rem] uppercase tracking-[0.12em] outline-none focus:border-primary"
              >
                <option value="">— brak —</option>
                {members.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name ?? m.email.split("@")[0]}
                  </option>
                ))}
              </select>
            </label>

            <div className="flex flex-col gap-2">
              <span className="eyebrow">Opis</span>
              <RichTextEditor
                name="descriptionJson"
                initial={null}
                readOnly={false}
                placeholder="Cel, zakres, kryteria sukcesu…"
              />
            </div>

            {!state?.ok && state?.error && (
              <p className="font-mono text-[0.72rem] uppercase tracking-[0.14em] text-destructive">
                {state.error}
              </p>
            )}

            <div className="sticky bottom-0 -mx-6 -mb-6 flex items-center justify-end gap-2 border-t border-border bg-background/95 px-6 py-4 backdrop-blur">
              <button
                type="button"
                onClick={onClose}
                className="inline-flex h-9 items-center justify-center rounded-md border border-border px-4 font-sans text-[0.85rem] text-muted-foreground transition-colors hover:text-foreground"
              >
                Anuluj
              </button>
              <button
                type="submit"
                disabled={pending}
                className="inline-flex h-9 items-center justify-center rounded-lg bg-brand-gradient px-5 font-sans text-[0.85rem] font-semibold text-white shadow-brand transition-[transform,opacity] duration-200 hover:-translate-y-[1px] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:opacity-60"
              >
                {pending ? "Zapisuję…" : isEdit ? "Zapisz" : "Utwórz"}
              </button>
            </div>
          </form>
        </BaseDialog.Popup>
      </BaseDialog.Portal>
    </BaseDialog.Root>
  );
}
