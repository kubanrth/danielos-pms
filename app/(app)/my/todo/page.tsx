import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { TodoWorkspace } from "@/components/my/todo/todo-workspace";
import { AppShell } from "@/components/layout/app-shell";

// Microsoft-To-Do-like sidebar has three "smart" views that don't map to
// stored TodoList rows — they're dynamic filters on the user's entire
// item collection:
//   my-day    — items where myDayAt >= start-of-today (auto-expires)
//   important — items where important=true
//   planned   — items where dueDate is set
export type SmartView = "my-day" | "important" | "planned";

function isSmartView(v: string | undefined): v is SmartView {
  return v === "my-day" || v === "important" || v === "planned";
}

export default async function MyTodoPage({
  searchParams,
}: {
  searchParams: Promise<{ listId?: string; smart?: string; itemId?: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/secure-access-portal");
  const userId = session.user.id;
  const params = await searchParams;

  const [folders, lists] = await Promise.all([
    db.todoFolder.findMany({
      where: { userId },
      orderBy: [{ parentId: "asc" }, { order: "asc" }],
    }),
    db.todoList.findMany({
      where: { userId },
      orderBy: [{ folderId: "asc" }, { order: "asc" }],
    }),
  ]);

  const smart = isSmartView(params.smart) ? params.smart : null;
  // Precedence: explicit listId > smart view > fall back to Mój dzień
  // (MS To Do always shows "My Day" as the default landing view).
  const activeListId = params.listId ?? null;
  const effectiveSmart: SmartView | null = !activeListId
    ? (smart ?? "my-day")
    : null;

  // Aggregate items — either from a single list or by smart-filter.
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const items = await (async () => {
    if (activeListId) {
      // Regular list view — scope by list + owner.
      const list = await db.todoList.findFirst({
        where: { id: activeListId, userId },
        select: { id: true },
      });
      if (!list) return [];
      return db.todoItem.findMany({
        where: { listId: activeListId, userId },
        orderBy: [{ completed: "asc" }, { important: "desc" }, { order: "asc" }],
        include: {
          steps: { orderBy: { order: "asc" } },
          list: { select: { id: true, name: true } },
        },
      });
    }

    // Smart view — pull across all lists, apply filter.
    const smartWhere = (() => {
      switch (effectiveSmart) {
        case "my-day":
          return { userId, myDayAt: { gte: todayStart } };
        case "important":
          return { userId, important: true };
        case "planned":
          return { userId, dueDate: { not: null } };
        default:
          return { userId };
      }
    })();
    return db.todoItem.findMany({
      where: smartWhere,
      orderBy: [{ completed: "asc" }, { dueDate: "asc" }, { important: "desc" }, { order: "asc" }],
      include: {
        steps: { orderBy: { order: "asc" } },
        list: { select: { id: true, name: true } },
      },
    });
  })();

  // Resolve active list name when viewing a single list.
  const activeList = activeListId
    ? lists.find((l) => l.id === activeListId) ?? null
    : null;

  // Also surface the "star" item by id if itemId is in URL — the client
  // can open the detail panel immediately without an extra fetch.
  const focusedItemId = params.itemId ?? null;

  return (
    <AppShell>
      <div className="mb-8 flex flex-col gap-2">
        <span className="eyebrow">Prywatne</span>
        <h1 className="font-display text-[2.2rem] font-bold leading-[1.1] tracking-[-0.03em]">
          Twoje <span className="text-brand-gradient">TO DO</span>.
        </h1>
        <p className="max-w-[60ch] text-[0.95rem] leading-[1.55] text-muted-foreground">
          Prywatny moduł. Nikt poza Tobą tego nie widzi. Kliknij zadanie
          żeby otworzyć szczegóły, gwiazdkę — żeby oznaczyć jako ważne.
        </p>
      </div>

      <TodoWorkspace
        folders={folders.map((f) => ({
          id: f.id,
          name: f.name,
          parentId: f.parentId,
        }))}
        lists={lists.map((l) => ({
          id: l.id,
          name: l.name,
          folderId: l.folderId,
        }))}
        activeListId={activeList?.id ?? null}
        activeListName={activeList?.name ?? null}
        smart={effectiveSmart}
        items={items.map((i) => ({
          id: i.id,
          content: i.content,
          completed: i.completed,
          important: i.important,
          myDayAt: i.myDayAt ? i.myDayAt.toISOString() : null,
          dueDate: i.dueDate ? i.dueDate.toISOString() : null,
          reminderAt: i.reminderAt ? i.reminderAt.toISOString() : null,
          notes: i.notes,
          listId: i.listId,
          listName: i.list.name,
          steps: i.steps.map((s) => ({
            id: s.id,
            title: s.title,
            completed: s.completed,
          })),
        }))}
        focusedItemId={focusedItemId}
      />
    </AppShell>
  );
}
