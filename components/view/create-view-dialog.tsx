"use client";

import { useActionState, useEffect, useState, startTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Table2,
  KanbanSquare,
  GitBranch,
  BarChart3,
  Pencil,
  Plus,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  createBoardViewAction,
  type CreateViewState,
} from "@/app/(app)/w/[workspaceId]/b/[boardId]/actions";
import type { ViewName } from "@/components/view/view-switcher";

const TYPE_OPTIONS: {
  value: "TABLE" | "KANBAN" | "ROADMAP" | "GANTT" | "WHITEBOARD";
  name: ViewName;
  label: string;
  icon: typeof Table2;
}[] = [
  { value: "TABLE", name: "table", label: "Tabela", icon: Table2 },
  { value: "KANBAN", name: "kanban", label: "Kanban", icon: KanbanSquare },
  { value: "ROADMAP", name: "roadmap", label: "Roadmapa", icon: GitBranch },
  { value: "GANTT", name: "gantt", label: "Gantt", icon: BarChart3 },
  { value: "WHITEBOARD", name: "whiteboard", label: "Whiteboard", icon: Pencil },
];

// Compact `+ Nowy widok` button rendered next to the ViewSwitcher. Opens
// a dialog, creates a BoardView with a chosen type + label, redirects to
// the new `/v/[viewId]` route on success.
export function CreateViewDialog({
  workspaceId,
  boardId,
  enabled,
}: {
  workspaceId: string;
  boardId: string;
  // Filter offered types to those enabled in this workspace.
  enabled: ViewName[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState<CreateViewState, FormData>(
    createBoardViewAction,
    null,
  );
  const [selectedType, setSelectedType] = useState<string>("TABLE");

  useEffect(() => {
    if (state?.ok) {
      // Closing a dialog in response to an async action result is the
      // "external → React" bridge the linter rule exempts; silence the
      // heuristic here so we don't need a parallel ref dance.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setOpen(false);
      router.push(`/w/${workspaceId}/b/${boardId}/v/${state.viewId}`);
      router.refresh();
    }
  }, [state, router, workspaceId, boardId]);

  const options = TYPE_OPTIONS.filter((t) => enabled.includes(t.name));

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Nowy widok"
        title="Nowy widok"
        className="ml-2 inline-flex h-8 items-center gap-1.5 rounded-md border border-dashed border-border bg-background px-3 font-mono text-[0.7rem] uppercase tracking-[0.14em] text-muted-foreground transition-colors hover:border-primary/60 hover:text-foreground"
      >
        <Plus size={12} />
        <span>Widok</span>
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="rounded-xl border-border bg-card sm:max-w-[480px]">
          <DialogHeader>
            <span className="eyebrow">Nowy widok</span>
            <DialogTitle className="font-display text-[1.45rem] font-bold leading-[1.15] tracking-[-0.02em] text-foreground">
              Dodaj <span className="text-brand-gradient">własny</span> widok do
              tablicy.
            </DialogTitle>
            <DialogDescription className="text-[0.9rem] leading-[1.55] text-muted-foreground">
              Ten sam typ widoku możesz mieć wiele razy — np. dwa Kanbany z
              różnymi filtrami.
            </DialogDescription>
          </DialogHeader>

          <form
            action={(fd) => {
              fd.set("workspaceId", workspaceId);
              fd.set("boardId", boardId);
              fd.set("type", selectedType);
              startTransition(() => formAction(fd));
            }}
            className="mt-2 flex flex-col gap-5"
          >
            <div className="flex flex-col gap-2">
              <span className="eyebrow">Typ widoku</span>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {options.map((t) => {
                  const Icon = t.icon;
                  const on = selectedType === t.value;
                  return (
                    <button
                      key={t.value}
                      type="button"
                      onClick={() => setSelectedType(t.value)}
                      data-on={on ? "true" : "false"}
                      className="group flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 font-mono text-[0.72rem] uppercase tracking-[0.12em] text-muted-foreground transition-all data-[on=true]:border-primary/60 data-[on=true]:bg-primary/10 data-[on=true]:text-foreground hover:border-primary/40"
                    >
                      <Icon
                        size={14}
                        className="text-muted-foreground group-data-[on=true]:text-primary"
                      />
                      <span className="flex-1 text-left">{t.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <label className="flex flex-col gap-2">
              <span className="eyebrow">Nazwa widoku</span>
              <input
                name="name"
                required
                autoFocus
                maxLength={60}
                placeholder="np. Sprint 4 · Kanban klienta"
                aria-invalid={!state?.ok && !!state?.fieldErrors?.name}
                className="h-10 border-b border-border bg-transparent pb-1 font-sans text-[1rem] outline-none focus:border-primary aria-[invalid=true]:border-destructive"
              />
              {!state?.ok && state?.fieldErrors?.name && (
                <span className="font-mono text-[0.68rem] text-destructive">
                  {state.fieldErrors.name}
                </span>
              )}
            </label>

            {!state?.ok && state?.error && (
              <p className="font-mono text-[0.72rem] uppercase tracking-[0.14em] text-destructive">
                {state.error}
              </p>
            )}

            <div className="flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="font-mono text-[0.72rem] uppercase tracking-[0.14em] text-muted-foreground transition-colors hover:text-foreground"
              >
                Anuluj
              </button>
              <button
                type="submit"
                disabled={pending}
                className="inline-flex h-10 items-center justify-center rounded-lg bg-brand-gradient px-5 font-sans text-[0.9rem] font-semibold text-white shadow-brand transition-[transform,opacity] duration-200 hover:-translate-y-[1px] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:opacity-60"
              >
                {pending ? "Tworzę…" : "Utwórz widok"}
              </button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
