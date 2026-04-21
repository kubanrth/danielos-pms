"use client";

import { useActionState, useState, startTransition } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  createWorkspaceAction,
  type WorkspaceFormState,
} from "@/app/(app)/workspaces/actions";

export function CreateWorkspaceDialog() {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState<WorkspaceFormState, FormData>(
    createWorkspaceAction,
    null,
  );

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="group flex min-h-[180px] flex-col items-start justify-between border border-dashed border-border p-6 text-left text-muted-foreground transition-[border-color,color] hover:border-primary/60 hover:text-foreground focus-visible:border-primary focus-visible:text-foreground focus-visible:outline-none"
      >
        <span className="eyebrow transition-colors group-hover:text-primary">
          Nowa przestrzeń
        </span>
        <div className="flex flex-col gap-1">
          <span className="font-display text-[1.4rem] leading-[1.1] tracking-[-0.02em]">
            + Utwórz workspace
          </span>
          <span className="font-mono text-[0.68rem] uppercase tracking-[0.14em] text-muted-foreground">
            kliknij aby rozpocząć
          </span>
        </div>
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="border-border bg-card sm:max-w-[520px]">
          <DialogHeader>
            <span className="eyebrow">Nowa przestrzeń robocza</span>
            <DialogTitle className="font-display text-[1.8rem] font-normal leading-[1.1] tracking-[-0.02em] text-foreground">
              Jak nazwiemy<br />
              <span className="italic text-primary">tę przestrzeń?</span>
            </DialogTitle>
            <DialogDescription className="text-[0.92rem] leading-[1.55] text-muted-foreground">
              Po utworzeniu trafisz do niej automatycznie. Zaczniesz z domyślną tablicą,
              do której możesz zaprosić innych.
            </DialogDescription>
          </DialogHeader>

          <form
            action={(fd) => startTransition(() => formAction(fd))}
            className="mt-2 flex flex-col gap-6"
          >
            <Field
              label="Nazwa"
              name="name"
              type="text"
              required
              autoFocus
              maxLength={60}
              placeholder="np. Marketing, Launch Q3"
              error={!state?.ok ? state?.fieldErrors?.name : undefined}
            />
            <Field
              label="Opis"
              name="description"
              type="text"
              asTextarea
              maxLength={280}
              placeholder="Opcjonalny — po co ta przestrzeń?"
              error={!state?.ok ? state?.fieldErrors?.description : undefined}
            />

            {!state?.ok && state?.error && (
              <p className="font-mono text-[0.72rem] uppercase tracking-[0.14em] text-destructive">
                {state.error}
              </p>
            )}

            <div className="mt-2 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="font-mono text-[0.72rem] uppercase tracking-[0.14em] text-muted-foreground transition-colors hover:text-foreground focus-visible:text-foreground"
              >
                Anuluj
              </button>
              <button
                type="submit"
                disabled={pending}
                className="group relative inline-flex h-11 items-center justify-center overflow-hidden bg-primary px-6 text-primary-foreground transition-[transform,opacity] duration-200 hover:-translate-y-[1px] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:translate-y-0 disabled:opacity-60"
                style={{
                  boxShadow:
                    "0 1px 0 color-mix(in oklch, var(--primary) 60%, black) inset, 0 10px 30px -12px color-mix(in oklch, var(--primary) 60%, transparent)",
                }}
              >
                <span className="relative z-10 font-sans text-[0.9rem] font-medium tracking-wide">
                  {pending ? "Tworzę…" : "Utwórz przestrzeń"}
                </span>
              </button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

function Field({
  label,
  name,
  type,
  required,
  autoFocus,
  maxLength,
  placeholder,
  asTextarea,
  error,
}: {
  label: string;
  name: string;
  type: string;
  required?: boolean;
  autoFocus?: boolean;
  maxLength?: number;
  placeholder?: string;
  asTextarea?: boolean;
  error?: string;
}) {
  const common = {
    name,
    required,
    autoFocus,
    maxLength,
    placeholder,
    "aria-invalid": !!error,
    className:
      "bg-transparent pb-1 text-[1rem] font-sans outline-none placeholder:text-muted-foreground/60 focus:border-primary aria-[invalid=true]:border-destructive",
  };
  return (
    <label className="flex flex-col gap-2">
      <span className="eyebrow">{label}</span>
      {asTextarea ? (
        <textarea
          {...common}
          rows={3}
          className={`${common.className} min-h-[3rem] resize-none border-b border-border`}
        />
      ) : (
        <input {...common} type={type} className={`${common.className} h-10 border-b border-border`} />
      )}
      {error && (
        <span className="font-mono text-[0.68rem] text-destructive">{error}</span>
      )}
    </label>
  );
}
