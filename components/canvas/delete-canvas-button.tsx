"use client";

import { useTransition } from "react";
import { Trash2 } from "lucide-react";
import { deleteCanvasAction } from "@/app/(app)/w/[workspaceId]/c/actions";

export function DeleteCanvasButton({ id, name }: { id: string; name: string }) {
  const [pending, startTransition] = useTransition();
  return (
    <form
      action={(fd) => {
        if (!window.confirm(`Usunąć kanwę "${name}"? Węzły i krawędzie znikną.`)) return;
        startTransition(() => deleteCanvasAction(fd));
      }}
      className="m-0"
    >
      <input type="hidden" name="id" value={id} />
      <button
        type="submit"
        disabled={pending}
        aria-label="Usuń kanwę"
        title="Usuń kanwę"
        className="grid h-7 w-7 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive disabled:opacity-60"
      >
        <Trash2 size={13} />
      </button>
    </form>
  );
}
