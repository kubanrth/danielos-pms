"use client";

import { useActionState, useState, startTransition } from "react";
import { Plus } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  createBoardAction,
  type CreateBoardState,
} from "@/app/(app)/w/[workspaceId]/b/actions";

// Compact `+` button intended for the sidebar (next to each workspace
// row, gated by role=ADMIN). Opens a dialog with just name + optional
// description; the action seeds columns + BoardView rows.
export function CreateBoardDialog({
  workspaceId,
  size = "sm",
  label,
}: {
  workspaceId: string;
  size?: "sm" | "md";
  // Optional label — when omitted we render just the "+" glyph (sidebar use).
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState<CreateBoardState, FormData>(
    createBoardAction,
    null,
  );

  return (
    <>
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen(true);
        }}
        aria-label="Nowa tablica"
        title="Nowa tablica"
        className={
          size === "sm"
            ? "grid h-7 w-7 shrink-0 place-items-center rounded-sm text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-foreground"
            : "inline-flex h-9 items-center gap-1.5 rounded-md border border-border bg-background px-3 font-mono text-[0.72rem] uppercase tracking-[0.14em] text-muted-foreground transition-colors hover:border-primary/60 hover:text-foreground"
        }
      >
        <Plus size={size === "sm" ? 13 : 14} />
        {label && <span>{label}</span>}
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="rounded-xl border-border bg-card sm:max-w-[480px]">
          <DialogHeader>
            <span className="eyebrow">Nowa tablica</span>
            <DialogTitle className="font-display text-[1.5rem] font-bold leading-[1.15] tracking-[-0.02em] text-foreground">
              Dodaj kolejny zbiór <span className="text-brand-gradient">danych</span>.
            </DialogTitle>
            <DialogDescription className="text-[0.9rem] leading-[1.55] text-muted-foreground">
              Nowa tablica dostanie te same 4 statusy i widoki co reszta tej
              przestrzeni. Wszystko możesz potem edytować.
            </DialogDescription>
          </DialogHeader>

          <form
            action={(fd) => startTransition(() => formAction(fd))}
            className="mt-2 flex flex-col gap-5"
          >
            <input type="hidden" name="workspaceId" value={workspaceId} />

            <label className="flex flex-col gap-2">
              <span className="eyebrow">Nazwa</span>
              <input
                name="name"
                required
                autoFocus
                maxLength={80}
                placeholder="np. Q2 Roadmap, Backlog, KPIs"
                aria-invalid={!state?.ok && !!state?.fieldErrors?.name}
                className="h-10 border-b border-border bg-transparent pb-1 font-sans text-[1rem] outline-none focus:border-primary aria-[invalid=true]:border-destructive"
              />
              {!state?.ok && state?.fieldErrors?.name && (
                <span className="font-mono text-[0.68rem] text-destructive">
                  {state.fieldErrors.name}
                </span>
              )}
            </label>

            <label className="flex flex-col gap-2">
              <span className="eyebrow">Opis</span>
              <textarea
                name="description"
                rows={2}
                maxLength={280}
                placeholder="Opcjonalny — co ta tablica śledzi?"
                className="min-h-[2.5rem] resize-none border-b border-border bg-transparent pb-1 font-sans text-[0.95rem] outline-none focus:border-primary"
              />
            </label>

            {!state?.ok && state?.error && (
              <p className="font-mono text-[0.72rem] uppercase tracking-[0.14em] text-destructive">
                {state.error}
              </p>
            )}

            <div className="mt-1 flex items-center justify-end gap-3">
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
                {pending ? "Tworzę…" : "Utwórz tablicę"}
              </button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
