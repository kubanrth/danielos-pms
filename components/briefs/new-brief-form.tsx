"use client";

import { startTransition, useState } from "react";
import { Plus } from "lucide-react";
import { createBriefAction } from "@/app/(app)/w/[workspaceId]/briefs/actions";

export function NewBriefForm({ workspaceId }: { workspaceId: string }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex h-10 shrink-0 items-center gap-2 rounded-lg bg-brand-gradient px-4 font-sans text-[0.9rem] font-semibold text-white shadow-brand transition-[transform,opacity] hover:-translate-y-[1px]"
      >
        <Plus size={14} /> Nowy brief
      </button>
    );
  }

  return (
    <form
      action={(fd) =>
        startTransition(async () => {
          await createBriefAction(fd);
          setOpen(false);
          setTitle("");
        })
      }
      className="flex shrink-0 items-center gap-2 rounded-lg border border-primary/40 bg-primary/5 px-3 py-2"
    >
      <input type="hidden" name="workspaceId" value={workspaceId} />
      <input
        name="title"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        autoFocus
        required
        maxLength={200}
        placeholder="Nazwa projektu…"
        onKeyDown={(e) => {
          if (e.key === "Escape") setOpen(false);
        }}
        className="h-8 w-[260px] rounded-md border border-border bg-background px-2 text-[0.88rem] outline-none focus:border-primary"
      />
      <button
        type="submit"
        disabled={!title.trim()}
        className="inline-flex h-8 items-center rounded-md bg-primary px-3 font-mono text-[0.66rem] font-semibold uppercase tracking-[0.14em] text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
      >
        Utwórz
      </button>
      <button
        type="button"
        onClick={() => setOpen(false)}
        className="font-mono text-[0.66rem] uppercase tracking-[0.14em] text-muted-foreground hover:text-foreground"
      >
        Anuluj
      </button>
    </form>
  );
}
