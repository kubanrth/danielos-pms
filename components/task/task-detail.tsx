"use client";

import { useActionState, startTransition, useState } from "react";
import { Trash2, Plus, Check, X } from "lucide-react";
import type { Role } from "@/lib/generated/prisma/enums";
import {
  createTagAction,
  deleteTaskAction,
  toggleAssigneeAction,
  toggleTagAction,
  updateTaskAction,
  type UpdateTaskState,
} from "@/app/(app)/w/[workspaceId]/t/actions";
import { RichTextEditor, type RichTextDoc } from "@/components/task/rich-text-editor";
import { CommentsSection, type CommentItem } from "@/components/task/comments-section";

const TAG_COLORS = [
  "#EF4444",
  "#F59E0B",
  "#10B981",
  "#3B82F6",
  "#8B5CF6",
  "#EC4899",
  "#64748B",
  "#14B8A6",
];

export interface TaskDetailProps {
  workspaceId: string;
  role: Role;
  task: {
    id: string;
    title: string;
    descriptionJson: RichTextDoc | null;
    statusColumnId: string | null;
    startAt: string | null;
    stopAt: string | null;
  };
  statusColumns: { id: string; name: string; colorHex: string }[];
  allMembers: {
    id: string;
    name: string | null;
    email: string;
    avatarUrl: string | null;
  }[];
  assigneeIds: Set<string>;
  allTags: { id: string; name: string; colorHex: string }[];
  tagIds: Set<string>;
  canEdit: boolean;
  canDelete: boolean;
  comments: CommentItem[];
  canComment: boolean;
  canModerateComments: boolean;
  currentUserId: string;
}

function toLocalInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  // datetime-local wants YYYY-MM-DDTHH:mm
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function TaskDetail({
  workspaceId,
  task,
  statusColumns,
  allMembers,
  assigneeIds,
  allTags,
  tagIds,
  canEdit,
  canDelete,
  comments,
  canComment,
  canModerateComments,
}: TaskDetailProps) {
  const [state, formAction, pending] = useActionState<UpdateTaskState, FormData>(
    updateTaskAction,
    null,
  );

  const fieldErrors = !state?.ok ? state?.fieldErrors : undefined;
  const flash = state?.ok ? state.message : null;

  return (
    <div className="flex flex-col gap-10">
      {/* Meta: ID + actions */}
      <div className="flex items-center justify-between">
        <span className="font-mono text-[0.7rem] uppercase tracking-[0.14em] text-muted-foreground">
          zadanie · {task.id.slice(-8)}
        </span>
        {canDelete && (
          <form action={deleteTaskAction}>
            <input type="hidden" name="id" value={task.id} />
            <input type="hidden" name="workspaceId" value={workspaceId} />
            <button
              type="submit"
              className="inline-flex items-center gap-1.5 font-mono text-[0.7rem] uppercase tracking-[0.12em] text-muted-foreground transition-colors hover:text-destructive"
            >
              <Trash2 size={12} /> usuń zadanie
            </button>
          </form>
        )}
      </div>

      {/* Main form — title, description, status, dates */}
      <form
        action={(fd) => startTransition(() => formAction(fd))}
        className="flex flex-col gap-6"
      >
        <input type="hidden" name="id" value={task.id} />

        <label className="flex flex-col gap-2">
          <span className="eyebrow">Tytuł</span>
          <input
            name="title"
            type="text"
            required
            maxLength={200}
            readOnly={!canEdit}
            defaultValue={task.title}
            aria-invalid={!!fieldErrors?.title}
            className="border-b border-border bg-transparent pb-2 font-display text-[1.8rem] leading-[1.15] tracking-[-0.02em] outline-none focus:border-primary aria-[invalid=true]:border-destructive"
          />
          {fieldErrors?.title && (
            <span className="font-mono text-[0.68rem] text-destructive">
              {fieldErrors.title}
            </span>
          )}
        </label>

        <div className="grid gap-6 md:grid-cols-3">
          <label className="flex flex-col gap-2">
            <span className="eyebrow">Status</span>
            <select
              name="statusColumnId"
              defaultValue={task.statusColumnId ?? ""}
              disabled={!canEdit}
              className="h-10 appearance-none border-b border-border bg-transparent pb-1 font-mono text-[0.82rem] uppercase tracking-[0.12em] outline-none focus:border-primary"
            >
              <option value="">— brak —</option>
              {statusColumns.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-2">
            <span className="eyebrow">Start</span>
            <input
              name="startAt"
              type="datetime-local"
              readOnly={!canEdit}
              defaultValue={toLocalInput(task.startAt)}
              className="h-10 border-b border-border bg-transparent pb-1 font-mono text-[0.85rem] outline-none focus:border-primary"
            />
          </label>
          <label className="flex flex-col gap-2">
            <span className="eyebrow">Koniec</span>
            <input
              name="stopAt"
              type="datetime-local"
              readOnly={!canEdit}
              defaultValue={toLocalInput(task.stopAt)}
              className="h-10 border-b border-border bg-transparent pb-1 font-mono text-[0.85rem] outline-none focus:border-primary"
            />
          </label>
        </div>

        <div className="flex flex-col gap-2">
          <span className="eyebrow">Opis</span>
          <RichTextEditor
            name="descriptionJson"
            initial={task.descriptionJson}
            readOnly={!canEdit}
          />
        </div>

        {!state?.ok && state?.error && (
          <p className="font-mono text-[0.72rem] uppercase tracking-[0.14em] text-destructive">
            {state.error}
          </p>
        )}

        {canEdit && (
          <div className="flex items-center gap-4">
            <button
              type="submit"
              disabled={pending}
              className="inline-flex h-10 items-center justify-center rounded-lg bg-brand-gradient px-5 font-sans text-[0.9rem] font-semibold text-white shadow-brand transition-[transform,opacity] duration-200 hover:-translate-y-[1px] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:opacity-60"
            >
              {pending ? "Zapisuję…" : "Zapisz"}
            </button>
            {flash && (
              <span className="font-mono text-[0.72rem] uppercase tracking-[0.14em] text-primary">
                {flash}
              </span>
            )}
          </div>
        )}
      </form>

      {/* Assignees */}
      <section className="flex flex-col gap-3">
        <span className="eyebrow">Osoby</span>
        <div className="flex flex-wrap gap-2">
          {allMembers.map((m) => {
            const active = assigneeIds.has(m.id);
            return (
              <form key={m.id} action={toggleAssigneeAction} className="m-0">
                <input type="hidden" name="taskId" value={task.id} />
                <input type="hidden" name="userId" value={m.id} />
                <button
                  type="submit"
                  disabled={!canEdit}
                  className="group inline-flex items-center gap-2 rounded-full border border-border px-2 py-1 text-[0.82rem] transition-colors data-[active=true]:border-primary data-[active=true]:bg-primary/10 data-[active=true]:text-foreground hover:border-primary/60 disabled:cursor-not-allowed"
                  data-active={active ? "true" : "false"}
                  title={m.email}
                >
                  <span className="grid h-5 w-5 shrink-0 place-items-center overflow-hidden rounded-full bg-brand-gradient font-display text-[0.62rem] font-bold text-white">
                    {m.avatarUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={m.avatarUrl} alt="" className="h-full w-full object-cover" />
                    ) : (
                      (m.name ?? m.email).slice(0, 2).toUpperCase()
                    )}
                  </span>
                  <span className="truncate">{m.name ?? m.email.split("@")[0]}</span>
                </button>
              </form>
            );
          })}
        </div>
      </section>

      {/* Tags */}
      <TagsSection
        workspaceId={workspaceId}
        taskId={task.id}
        allTags={allTags}
        tagIds={tagIds}
        canEdit={canEdit}
      />

      {/* Comments */}
      <CommentsSection
        taskId={task.id}
        comments={comments}
        canComment={canComment}
        canModerateComments={canModerateComments}
      />
    </div>
  );
}

function TagsSection({
  workspaceId,
  taskId,
  allTags,
  tagIds,
  canEdit,
}: {
  workspaceId: string;
  taskId: string;
  allTags: { id: string; name: string; colorHex: string }[];
  tagIds: Set<string>;
  canEdit: boolean;
}) {
  const [creating, setCreating] = useState(false);
  const [color, setColor] = useState(TAG_COLORS[0]);

  return (
    <section className="flex flex-col gap-3">
      <span className="eyebrow">Tagi</span>
      {allTags.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {allTags.map((t) => {
            const active = tagIds.has(t.id);
            return (
              <form key={t.id} action={toggleTagAction} className="m-0">
                <input type="hidden" name="taskId" value={taskId} />
                <input type="hidden" name="tagId" value={t.id} />
                <button
                  type="submit"
                  disabled={!canEdit}
                  data-active={active ? "true" : "false"}
                  className="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[0.78rem] font-medium transition-[border-color,opacity] data-[active=false]:opacity-50 hover:opacity-100 disabled:cursor-not-allowed"
                  style={{
                    borderColor: active ? t.colorHex : "var(--border)",
                    background: active ? `${t.colorHex}1A` : "transparent",
                    color: active ? t.colorHex : "var(--foreground)",
                  }}
                >
                  <span className="h-2 w-2 rounded-full" style={{ background: t.colorHex }} />
                  {t.name}
                </button>
              </form>
            );
          })}
        </div>
      ) : (
        <p className="text-[0.88rem] text-muted-foreground">Brak tagów.</p>
      )}

      {canEdit && (
        creating ? (
          <form
            action={createTagAction}
            onSubmit={() => {
              setCreating(false);
              setColor(TAG_COLORS[0]);
            }}
            className="flex flex-wrap items-center gap-2 rounded-lg border border-primary/40 bg-primary/5 p-2"
          >
            <input type="hidden" name="workspaceId" value={workspaceId} />
            <input type="hidden" name="colorHex" value={color} />
            <input
              name="name"
              type="text"
              required
              maxLength={32}
              placeholder="np. urgent"
              autoFocus
              className="flex-1 min-w-[140px] rounded-md bg-transparent px-2 py-1 text-[0.82rem] outline-none focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary"
            />
            <div className="flex items-center gap-1">
              {TAG_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className="grid h-6 w-6 place-items-center rounded-full transition-transform hover:scale-110"
                  style={{
                    background: c,
                    outline: color === c ? "2px solid var(--foreground)" : "none",
                    outlineOffset: color === c ? 2 : 0,
                  }}
                  aria-label={`kolor ${c}`}
                />
              ))}
            </div>
            <button
              type="submit"
              className="grid h-8 w-8 place-items-center rounded-md bg-brand-gradient text-white transition-opacity hover:opacity-90"
              aria-label="Utwórz tag"
            >
              <Check size={14} />
            </button>
            <button
              type="button"
              onClick={() => setCreating(false)}
              className="grid h-8 w-8 place-items-center rounded-md border border-border text-muted-foreground transition-colors hover:text-foreground"
              aria-label="Anuluj"
            >
              <X size={14} />
            </button>
          </form>
        ) : (
          <button
            type="button"
            onClick={() => setCreating(true)}
            className="inline-flex h-8 w-fit items-center gap-1.5 rounded-full border border-dashed border-border px-3 font-mono text-[0.68rem] uppercase tracking-[0.14em] text-muted-foreground transition-colors hover:border-primary/60 hover:text-foreground"
          >
            <Plus size={12} /> Nowy tag
          </button>
        )
      )}
    </section>
  );
}
