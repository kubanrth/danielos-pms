import Link from "next/link";
import { fetchTaskDetail } from "@/lib/task-fetch";
import { TaskDetail } from "@/components/task/task-detail";

export default async function TaskPage({
  params,
}: {
  params: Promise<{ workspaceId: string; taskId: string }>;
}) {
  const { workspaceId, taskId } = await params;
  const data = await fetchTaskDetail(workspaceId, taskId);

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4">
      <Link
        href={`/w/${workspaceId}`}
        className="eyebrow inline-flex w-fit transition-colors hover:text-foreground focus-visible:text-foreground"
      >
        ← wróć do przeglądu
      </Link>
      <TaskDetail {...data} />
    </div>
  );
}
