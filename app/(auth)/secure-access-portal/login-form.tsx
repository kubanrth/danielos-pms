"use client";

import { useActionState } from "react";
import { loginAction, type LoginState } from "./actions";

export function LoginForm({ redirectTo }: { redirectTo?: string }) {
  const [state, formAction, pending] = useActionState<LoginState, FormData>(
    loginAction,
    null,
  );

  return (
    <form action={formAction} className="flex flex-col gap-6">
      <input type="hidden" name="redirectTo" value={redirectTo ?? "/workspaces"} />

      <Field
        label="Email"
        name="email"
        type="email"
        autoComplete="username"
        required
        error={state?.fieldErrors?.email}
      />
      <Field
        label="Hasło"
        name="password"
        type="password"
        autoComplete="current-password"
        required
        error={state?.fieldErrors?.password}
      />
      <Field
        label="Kod 2FA (jeśli włączone)"
        name="totp"
        type="text"
        autoComplete="one-time-code"
        // inputMode text (not numeric) so users can paste XXXX-XXXX-XXXX
        // recovery codes into the same field.
        error={state?.fieldErrors?.totp}
      />

      {state?.error && (
        <p
          role="alert"
          className="font-mono text-[0.72rem] uppercase tracking-[0.14em] text-destructive"
        >
          {state.error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="group relative mt-2 inline-flex h-12 items-center justify-center overflow-hidden rounded-lg bg-brand-gradient px-6 text-white shadow-brand transition-[transform,opacity] duration-200 hover:-translate-y-[1px] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:translate-y-0 disabled:opacity-60"
      >
        <span className="relative z-10 font-sans text-[0.92rem] font-semibold tracking-wide">
          {pending ? "Loguję…" : "Wejdź do systemu"}
        </span>
      </button>
    </form>
  );
}

function Field({
  label,
  name,
  type,
  autoComplete,
  required,
  error,
}: {
  label: string;
  name: string;
  type: string;
  autoComplete?: string;
  required?: boolean;
  error?: string;
}) {
  return (
    <label className="group flex flex-col gap-2">
      <span className="eyebrow">{label}</span>
      <input
        name={name}
        type={type}
        autoComplete={autoComplete}
        required={required}
        aria-invalid={!!error}
        className="h-10 border-b border-border bg-transparent pb-1 text-[1.02rem] font-sans outline-none placeholder:text-muted-foreground/60 focus:border-primary aria-[invalid=true]:border-destructive"
      />
      {error && (
        <span className="font-mono text-[0.68rem] text-destructive">{error}</span>
      )}
    </label>
  );
}
