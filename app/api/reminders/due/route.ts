import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

// F11-12 (#2): klient zgłosił że dymki przypomnień nie wyskakują —
// poprzednio layout fetchował due reminders RAZ przy SSR i renderował
// statyczną listę. Tworząc reminder na "za 5 minut" user nie widział
// popupu bez ręcznego refresha.
//
// Ten endpoint zwraca aktualnie wymagalne reminders dla zalogowanego
// usera; ReminderPopups poll'uje go co 60s i merge'uje nowe entry.
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ items: [] });
  }
  const items = await db.personalReminder.findMany({
    where: {
      recipientId: session.user.id,
      dueAt: { lte: new Date() },
      dismissedAt: null,
    },
    orderBy: { dueAt: "asc" },
    take: 5,
    include: {
      creator: { select: { id: true, name: true, email: true } },
    },
  });
  return NextResponse.json({
    items: items.map((r) => ({
      id: r.id,
      title: r.title,
      body: r.body,
      creatorName: r.creator.name ?? r.creator.email,
      isSelfAuthored: r.creator.id === session.user.id,
    })),
  });
}
