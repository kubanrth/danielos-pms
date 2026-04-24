"use client";

import { startTransition, useEffect, useState } from "react";
import Link from "next/link";
import { Bell, X } from "lucide-react";
import { dismissReminderAction } from "@/app/(app)/my/reminders/actions";

export interface DuePopup {
  id: string;
  title: string;
  body: string | null;
  creatorName: string;
  isSelfAuthored: boolean;
}

// F9-16: stacked floating popups in the top-right corner for every
// reminder that's due + not yet dismissed by the recipient. Rendered
// once globally from the (app) layout.
export function ReminderPopups({ initial }: { initial: DuePopup[] }) {
  // Client-side mirror so "dismiss" hides the card immediately — we
  // don't need to await the server round-trip to remove it visually.
  const [list, setList] = useState<DuePopup[]>(initial);

  useEffect(() => {
    setList(initial);
  }, [initial]);

  if (list.length === 0) return null;

  return (
    <div className="pointer-events-none fixed right-4 top-4 z-[60] flex w-[340px] flex-col gap-2">
      {list.map((r) => (
        <ReminderBubble
          key={r.id}
          reminder={r}
          onDismiss={() => setList((prev) => prev.filter((x) => x.id !== r.id))}
        />
      ))}
    </div>
  );
}

function ReminderBubble({
  reminder,
  onDismiss,
}: {
  reminder: DuePopup;
  onDismiss: () => void;
}) {
  return (
    <div className="pointer-events-auto flex items-start gap-3 rounded-xl border border-border bg-card p-3 shadow-[0_12px_32px_-12px_rgba(10,10,40,0.25)] backdrop-blur">
      <span
        className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-primary/10 text-primary"
        aria-hidden
      >
        <Bell size={14} />
      </span>

      <Link
        href="/my/reminders"
        className="flex min-w-0 flex-1 flex-col gap-0.5"
      >
        <span className="truncate font-display text-[0.95rem] font-semibold leading-tight tracking-[-0.01em]">
          {reminder.title}
        </span>
        {reminder.body && (
          <span className="truncate text-[0.82rem] text-muted-foreground">
            {reminder.body}
          </span>
        )}
        <span className="mt-0.5 font-mono text-[0.58rem] uppercase tracking-[0.14em] text-muted-foreground">
          {reminder.isSelfAuthored ? "Ty sobie" : `od ${reminder.creatorName}`}
        </span>
      </Link>

      <form
        action={(fd) =>
          startTransition(() => {
            dismissReminderAction(fd);
            onDismiss();
          })
        }
        className="m-0"
      >
        <input type="hidden" name="id" value={reminder.id} />
        <button
          type="submit"
          aria-label="Schowaj"
          title="Schowaj (zostaje na liście)"
          className="grid h-6 w-6 shrink-0 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          <X size={12} />
        </button>
      </form>
    </div>
  );
}
