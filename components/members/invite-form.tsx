"use client";

import { useActionState, startTransition, useState, useEffect } from "react";
import { Copy, Check } from "lucide-react";
import {
  inviteMemberAction,
  type InviteState,
} from "@/app/(app)/w/[workspaceId]/members/actions";

export function InviteForm({ workspaceId }: { workspaceId: string }) {
  const [state, formAction, pending] = useActionState<InviteState, FormData>(
    inviteMemberAction,
    null,
  );
  const [copied, setCopied] = useState(false);
  const fieldErrors = !state?.ok ? state?.fieldErrors : undefined;

  useEffect(() => {
    if (copied) {
      const t = setTimeout(() => setCopied(false), 1500);
      return () => clearTimeout(t);
    }
  }, [copied]);

  async function copyUrl() {
    if (!state?.ok) return;
    try {
      await navigator.clipboard.writeText(state.inviteUrl);
      setCopied(true);
    } catch {
      /* noop */
    }
  }

  return (
    <form
      action={(fd) => startTransition(() => formAction(fd))}
      className="flex flex-col gap-5 rounded-xl border border-border bg-card p-6 shadow-[0_1px_2px_rgba(10,10,40,0.04)]"
    >
      <input type="hidden" name="workspaceId" value={workspaceId} />

      <div className="flex flex-col gap-1.5">
        <span className="eyebrow">Nowe zaproszenie</span>
        <h3 className="font-display text-[1.2rem] font-bold leading-[1.2] tracking-[-0.02em]">
          Zaproś osobę do przestrzeni
        </h3>
      </div>

      <div className="grid gap-4 md:grid-cols-[1fr_140px_auto]">
        <label className="flex flex-col gap-1.5">
          <span className="eyebrow">Email</span>
          <input
            name="email"
            type="email"
            required
            placeholder="np. anna@firma.pl"
            aria-invalid={!!fieldErrors?.email}
            className="h-10 border-b border-border bg-transparent pb-1 text-[0.95rem] outline-none focus:border-primary aria-[invalid=true]:border-destructive"
          />
          {fieldErrors?.email && (
            <span className="font-mono text-[0.66rem] text-destructive">
              {fieldErrors.email}
            </span>
          )}
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="eyebrow">Rola</span>
          <select
            name="role"
            defaultValue="MEMBER"
            className="h-10 appearance-none border-b border-border bg-transparent pb-1 font-mono text-[0.9rem] outline-none focus:border-primary"
          >
            <option value="ADMIN">ADMIN</option>
            <option value="MEMBER">MEMBER</option>
            <option value="VIEWER">VIEWER</option>
          </select>
        </label>

        <div className="flex items-end">
          <button
            type="submit"
            disabled={pending}
            className="inline-flex h-10 items-center justify-center rounded-lg bg-brand-gradient px-5 font-sans text-[0.88rem] font-semibold text-white shadow-brand transition-[transform,opacity] duration-200 hover:-translate-y-[1px] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:opacity-60"
          >
            {pending ? "Wysyłam…" : "Wyślij zaproszenie"}
          </button>
        </div>
      </div>

      {!state?.ok && state?.error && (
        <p className="font-mono text-[0.72rem] uppercase tracking-[0.14em] text-destructive">
          {state.error}
        </p>
      )}

      {state?.ok && (
        <div className="flex flex-col gap-3 rounded-lg border border-primary/30 bg-primary/5 p-4">
          <div className="flex items-center gap-2">
            <span className="eyebrow text-primary">
              Zaproszenie {state.emailed ? "wysłane" : "utworzone"}
            </span>
            {!state.emailed && (
              <span className="font-mono text-[0.64rem] uppercase tracking-[0.14em] text-muted-foreground">
                (email nie skonfigurowany — skopiuj link ręcznie)
              </span>
            )}
          </div>
          <div className="flex items-center gap-3">
            <code className="min-w-0 flex-1 truncate rounded-md bg-muted px-3 py-2 font-mono text-[0.82rem]">
              {state.inviteUrl}
            </code>
            <button
              type="button"
              onClick={copyUrl}
              className="inline-flex h-9 items-center justify-center gap-1.5 rounded-md border border-border px-3 font-mono text-[0.72rem] uppercase tracking-[0.14em] text-muted-foreground transition-colors hover:border-primary hover:text-foreground"
            >
              {copied ? <Check size={13} /> : <Copy size={13} />}
              {copied ? "Skopiowano" : "Kopiuj"}
            </button>
          </div>
          <p className="font-mono text-[0.64rem] uppercase tracking-[0.14em] text-muted-foreground">
            Link ważny 14 dni.
          </p>
        </div>
      )}
    </form>
  );
}
