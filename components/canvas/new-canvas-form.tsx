"use client";

import { useActionState, startTransition, useRef } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import {
  createCanvasAction,
  type CreateCanvasState,
} from "@/app/(app)/w/[workspaceId]/c/actions";

export function NewCanvasForm({ workspaceId }: { workspaceId: string }) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction, pending] = useActionState<CreateCanvasState, FormData>(
    createCanvasAction,
    null,
  );

  // Navigate into the new canvas on success so the user starts drawing
  // immediately instead of bouncing back through the list.
  if (state?.ok && state.canvasId) {
    queueMicrotask(() =>
      router.push(`/w/${workspaceId}/c/${state.canvasId}`),
    );
  }

  const fieldError = !state?.ok ? state?.fieldErrors?.name : undefined;

  return (
    <form
      ref={formRef}
      action={(fd) => startTransition(() => formAction(fd))}
      className="flex flex-wrap items-start gap-2 rounded-xl border border-border bg-card p-3"
    >
      <input type="hidden" name="workspaceId" value={workspaceId} />
      <div className="flex flex-1 flex-col gap-1">
        <input
          name="name"
          type="text"
          required
          maxLength={200}
          placeholder="np. Onboarding klienta"
          aria-invalid={!!fieldError}
          className="h-10 min-w-[240px] rounded-md border border-border bg-background px-3 text-[0.92rem] outline-none focus:border-primary aria-[invalid=true]:border-destructive"
        />
        {fieldError && (
          <span className="font-mono text-[0.68rem] text-destructive">{fieldError}</span>
        )}
      </div>
      <button
        type="submit"
        disabled={pending}
        className="inline-flex h-10 items-center gap-1.5 rounded-lg bg-brand-gradient px-4 font-sans text-[0.88rem] font-semibold text-white shadow-brand transition-[transform,opacity] duration-200 hover:-translate-y-[1px] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:opacity-60"
      >
        <Plus size={14} /> {pending ? "Tworzę…" : "Nowa kanwa"}
      </button>
    </form>
  );
}
