import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export default async function ProfilePage() {
  const session = await auth();
  const user = await db.user.findUnique({ where: { id: session!.user.id } });
  if (!user) throw new Error("User not found");

  return (
    <main className="flex-1 px-8 py-12 md:px-14 md:py-16">
      <div className="mx-auto flex max-w-[640px] flex-col gap-10">
        <div className="flex flex-col gap-2">
          <span className="eyebrow">Ustawienia konta</span>
          <h1 className="font-display text-[2rem] leading-[1.1] tracking-[-0.02em]">
            Twój profil
          </h1>
          <p className="text-[0.92rem] leading-[1.55] text-muted-foreground">
            Te informacje widzą inni członkowie w twoich przestrzeniach roboczych.
          </p>
        </div>

        <dl className="grid grid-cols-[minmax(100px,140px)_1fr] gap-x-8 gap-y-6 border-t border-border pt-6">
          <dt className="eyebrow">Email</dt>
          <dd className="font-mono text-[0.92rem]">{user.email}</dd>

          <dt className="eyebrow">Imię</dt>
          <dd className="font-display text-[1.1rem] leading-[1.2]">
            {user.name ?? <span className="text-muted-foreground">(nie ustawione)</span>}
          </dd>

          <dt className="eyebrow">Strefa czasowa</dt>
          <dd className="font-mono text-[0.92rem]">{user.timezone}</dd>

          <dt className="eyebrow">Rola w systemie</dt>
          <dd className="font-mono text-[0.92rem]">
            {user.isSuperAdmin ? (
              <span className="rounded-sm bg-primary/10 px-1.5 py-0.5 text-primary">
                super admin
              </span>
            ) : (
              "member"
            )}
          </dd>
        </dl>

        <div className="border-t border-border pt-6 text-[0.82rem] leading-[1.55] text-muted-foreground">
          <span className="eyebrow text-muted-foreground">
            Edycja profilu + upload awatara — F1b
          </span>
        </div>
      </div>
    </main>
  );
}
