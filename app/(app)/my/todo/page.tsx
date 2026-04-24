import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { TodoWorkspace } from "@/components/my/todo/todo-workspace";

// Private TODO — not linked to any workspace/board. One query per level
// keeps the page fast even with deep folder trees (hundreds of folders).
export default async function MyTodoPage({
  searchParams,
}: {
  searchParams: Promise<{ listId?: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/secure-access-portal");
  const userId = session.user.id;
  const { listId } = await searchParams;

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

  // Pick a default list if none selected — first list of user or null.
  const activeListId = listId ?? lists[0]?.id ?? null;
  const activeList = activeListId
    ? await db.todoList.findFirst({
        where: { id: activeListId, userId },
        include: {
          items: { orderBy: [{ completed: "asc" }, { order: "asc" }] },
        },
      })
    : null;

  return (
    <main className="flex-1 px-8 py-10 md:px-14 md:py-14">
      <div className="mx-auto max-w-6xl">
        <div className="mb-8 flex flex-col gap-2">
          <span className="eyebrow">Prywatne</span>
          <h1 className="font-display text-[2.2rem] font-bold leading-[1.1] tracking-[-0.03em]">
            Twoje <span className="text-brand-gradient">TO DO</span>.
          </h1>
          <p className="max-w-[60ch] text-[0.95rem] leading-[1.55] text-muted-foreground">
            Prywatny moduł. Nikt poza Tobą tego nie widzi. Twórz foldery,
            dowolną liczbę list i zadania w każdej z nich.
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
          items={
            activeList?.items.map((i) => ({
              id: i.id,
              content: i.content,
              completed: i.completed,
            })) ?? []
          }
        />
      </div>
    </main>
  );
}
