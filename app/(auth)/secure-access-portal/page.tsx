import type { Metadata } from "next";
import { LoginForm } from "./login-form";

export const metadata: Metadata = {
  title: "Wejście · DANIELOS",
};

export default async function SecureAccessPortalPage({
  searchParams,
}: {
  searchParams: Promise<{ redirect?: string }>;
}) {
  const { redirect } = await searchParams;

  return (
    <div className="relative flex min-h-dvh flex-col justify-between bg-background">
      {/* Background atmosphere — layered radial + subtle grain */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 opacity-70"
        style={{
          backgroundImage:
            "radial-gradient(60% 50% at 85% 10%, color-mix(in oklch, var(--accent-brand) 12%, transparent) 0%, transparent 60%)," +
            "radial-gradient(40% 30% at 10% 90%, color-mix(in oklch, var(--accent-brand) 8%, transparent) 0%, transparent 60%)",
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 opacity-[0.035] bg-grain"
      />

      {/* Top bar — editorial masthead */}
      <header className="flex items-center justify-between px-8 pt-8 md:px-14 md:pt-10">
        <span className="eyebrow">DANIELOS · v0.1</span>
        <span className="eyebrow hidden md:inline">secure access portal</span>
      </header>

      {/* Center */}
      <main className="mx-auto flex w-full max-w-[420px] flex-1 flex-col justify-center px-6 py-16">
        <div className="mb-10 flex flex-col items-start gap-3">
          <span className="eyebrow">Zaloguj się</span>
          <h1
            className="font-display text-[3.4rem] leading-[0.95] tracking-[-0.035em] text-foreground"
            style={{ fontVariationSettings: '"opsz" 144, "SOFT" 50, "WONK" 0' }}
          >
            Dobry,<br />
            <span className="italic text-primary">wracaj do pracy.</span>
          </h1>
          <p className="mt-4 max-w-[36ch] text-[0.95rem] leading-[1.6] text-muted-foreground">
            Zaloguj się swoim kontem służbowym, aby wejść do systemu zarządzania projektami.
          </p>
        </div>

        <LoginForm redirectTo={redirect} />

        <p className="mt-10 font-mono text-[0.68rem] uppercase tracking-[0.18em] text-muted-foreground">
          Problem z dostępem? Skontaktuj się z administratorem workspace'u.
        </p>
      </main>

      {/* Footer */}
      <footer className="flex items-center justify-between px-8 pb-8 md:px-14 md:pb-10">
        <span className="eyebrow">© {new Date().getFullYear()} · Wewnętrzny dostęp</span>
        <span className="eyebrow hidden md:inline">Not for public distribution</span>
      </footer>
    </div>
  );
}
