import { db } from "@/lib/db";
import { AcceptInviteForm } from "./accept-form";

export default async function InvitePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  const invitation = await db.invitation.findUnique({
    where: { token },
    include: {
      workspace: { select: { name: true, deletedAt: true } },
      inviter: { select: { name: true, email: true } },
    },
  });

  const invalidState = !invitation
    ? "not-found"
    : invitation.workspace.deletedAt
      ? "workspace-deleted"
      : invitation.acceptedAt
        ? "already-used"
        : invitation.expiresAt.getTime() < Date.now()
          ? "expired"
          : null;

  if (invalidState || !invitation) {
    const message = {
      "not-found": "Zaproszenie nie istnieje lub zostało cofnięte.",
      "workspace-deleted": "Przestrzeń, do której zostałaś/eś zaproszona/y, już nie istnieje.",
      "already-used": "To zaproszenie zostało już wykorzystane.",
      expired: "To zaproszenie wygasło. Poproś admina o nowe.",
    }[invalidState as "not-found" | "workspace-deleted" | "already-used" | "expired"];

    return (
      <div className="flex min-h-dvh items-center justify-center bg-background px-6">
        <div className="flex max-w-[420px] flex-col gap-4">
          <span className="eyebrow text-destructive">Zaproszenie nieprawidłowe</span>
          <h1 className="font-display text-[2rem] leading-[1.1] tracking-[-0.02em]">
            Ups. Coś poszło nie tak.
          </h1>
          <p className="text-[0.95rem] leading-[1.55] text-muted-foreground">{message}</p>
        </div>
      </div>
    );
  }

  const existingUser = await db.user.findUnique({
    where: { email: invitation.email },
    select: { id: true, passwordHash: true },
  });

  const isExistingUser = Boolean(existingUser?.passwordHash);

  return (
    <div className="relative flex min-h-dvh flex-col justify-between bg-background">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 opacity-70"
        style={{
          backgroundImage:
            "radial-gradient(60% 50% at 85% 10%, color-mix(in oklch, var(--accent-brand) 12%, transparent) 0%, transparent 60%)," +
            "radial-gradient(40% 30% at 10% 90%, color-mix(in oklch, var(--accent-brand) 8%, transparent) 0%, transparent 60%)",
        }}
      />

      <header className="flex items-center justify-between px-8 pt-8 md:px-14 md:pt-10">
        <span className="eyebrow">DANIELOS · zaproszenie</span>
      </header>

      <main className="mx-auto flex w-full max-w-[440px] flex-1 flex-col justify-center px-6 py-16">
        <div className="mb-10 flex flex-col items-start gap-3">
          <span className="eyebrow">Zostałaś/eś zaproszona/y</span>
          <h1
            className="font-display text-[2.8rem] leading-[1.0] tracking-[-0.035em]"
          >
            Dołącz do<br />
            <span className="italic text-primary">{invitation.workspace.name}.</span>
          </h1>
          <p className="mt-3 max-w-[38ch] text-[0.95rem] leading-[1.6] text-muted-foreground">
            {invitation.inviter.name ?? invitation.inviter.email} zaprasza Cię jako{" "}
            <span className="font-mono text-foreground">{invitation.role.toLowerCase()}</span>.
            {isExistingUser
              ? " Wygląda na to, że masz już konto w DANIELOS — wpisz hasło, żeby dołączyć."
              : " Ustaw hasło, aby założyć konto i dołączyć."}
          </p>
        </div>

        <AcceptInviteForm
          token={invitation.token}
          email={invitation.email}
          isExistingUser={isExistingUser}
        />
      </main>

      <footer className="flex items-center justify-between px-8 pb-8 md:px-14 md:pb-10">
        <span className="eyebrow">Wewnętrzny dostęp</span>
      </footer>
    </div>
  );
}
