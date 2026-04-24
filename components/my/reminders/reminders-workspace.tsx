"use client";

import { startTransition, useState } from "react";
import { Bell, BellOff, Clock, Plus, Trash2, User as UserIcon } from "lucide-react";
import {
  createReminderAction,
  deleteReminderAction,
  dismissReminderAction,
} from "@/app/(app)/my/reminders/actions";

export interface ReminderMember {
  id: string;
  name: string | null;
  email: string;
}

export interface ReminderRow {
  id: string;
  title: string;
  body: string | null;
  dueAt: string;
  dismissedAt: string | null;
  recipientName?: string;
  recipientId?: string;
  creatorName?: string;
  creatorId?: string;
  isMine: boolean;
}

export function RemindersWorkspace({
  currentUserId,
  members,
  sent,
  received,
}: {
  currentUserId: string;
  members: ReminderMember[];
  sent: ReminderRow[];
  received: ReminderRow[];
}) {
  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-2">
        <span className="eyebrow">Prywatne</span>
        <h1 className="font-display text-[2.2rem] font-bold leading-[1.1] tracking-[-0.03em]">
          Twoje <span className="text-brand-gradient">przypomnienia</span>.
        </h1>
        <p className="max-w-[60ch] text-[0.95rem] leading-[1.55] text-muted-foreground">
          Przypomnienia wyskakują jako dymek w prawym górnym rogu gdy
          nadejdzie ich termin. Możesz je wysłać sobie lub członkom
          workspace'u.
        </p>
      </div>

      <NewReminderForm currentUserId={currentUserId} members={members} />

      <Section title="Wysłane przeze mnie" items={sent} currentUserId={currentUserId} />
      <Section title="Dla mnie" items={received} currentUserId={currentUserId} />
    </div>
  );
}

function NewReminderForm({
  currentUserId,
  members,
}: {
  currentUserId: string;
  members: ReminderMember[];
}) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [dueAt, setDueAt] = useState(() => {
    // Default to 1 hour from now so "Create" works out-of-the-box.
    const d = new Date(Date.now() + 60 * 60 * 1000);
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  });
  const [recipientId, setRecipientId] = useState(currentUserId);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex h-10 w-fit items-center gap-2 rounded-lg bg-brand-gradient px-4 font-sans text-[0.9rem] font-semibold text-white shadow-brand transition-[transform,opacity] hover:-translate-y-[1px]"
      >
        <Plus size={14} /> Dodaj przypomnienie
      </button>
    );
  }

  return (
    <form
      action={(fd) =>
        startTransition(async () => {
          await createReminderAction(fd);
          setOpen(false);
          setTitle("");
          setBody("");
        })
      }
      className="flex flex-col gap-4 rounded-xl border border-primary/40 bg-primary/5 p-5"
    >
      <input type="hidden" name="recipientId" value={recipientId} />
      <div className="flex flex-col gap-1.5">
        <span className="eyebrow">Tytuł</span>
        <input
          name="title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
          autoFocus
          maxLength={200}
          placeholder="O czym chcesz pamiętać?"
          className="h-10 border-b border-border bg-transparent pb-1 font-display text-[1.1rem] outline-none focus:border-primary"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <span className="eyebrow">Opis (opcjonalny)</span>
        <textarea
          name="body"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={2}
          maxLength={2000}
          placeholder="Dodatkowy kontekst…"
          className="min-h-[3rem] resize-none rounded-md border border-border bg-background p-2 text-[0.9rem] outline-none focus:border-primary"
        />
      </div>

      <div className="flex flex-wrap items-end gap-4">
        <div className="flex flex-col gap-1.5">
          <span className="eyebrow">Kiedy</span>
          <input
            name="dueAt"
            type="datetime-local"
            value={dueAt}
            onChange={(e) => setDueAt(e.target.value)}
            required
            className="h-9 rounded-md border border-border bg-background px-3 font-mono text-[0.8rem] outline-none focus:border-primary"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <span className="eyebrow">Komu</span>
          <select
            value={recipientId}
            onChange={(e) => setRecipientId(e.target.value)}
            className="h-9 rounded-md border border-border bg-background px-3 font-mono text-[0.72rem] uppercase tracking-[0.12em] outline-none focus:border-primary"
          >
            <option value={currentUserId}>Ja (sobie)</option>
            {members
              .filter((m) => m.id !== currentUserId)
              .map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name ?? m.email}
                </option>
              ))}
          </select>
        </div>
      </div>

      <div className="flex items-center justify-end gap-3">
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="font-mono text-[0.72rem] uppercase tracking-[0.14em] text-muted-foreground transition-colors hover:text-foreground"
        >
          Anuluj
        </button>
        <button
          type="submit"
          className="inline-flex h-10 items-center justify-center rounded-lg bg-brand-gradient px-5 font-sans text-[0.9rem] font-semibold text-white shadow-brand transition-[transform,opacity] hover:-translate-y-[1px]"
        >
          Utwórz przypomnienie
        </button>
      </div>
    </form>
  );
}

function Section({
  title,
  items,
  currentUserId,
}: {
  title: string;
  items: ReminderRow[];
  currentUserId: string;
}) {
  if (items.length === 0) return null;
  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-baseline gap-3">
        <h2 className="eyebrow text-primary">{title}</h2>
        <span className="font-mono text-[0.68rem] uppercase tracking-[0.14em] text-muted-foreground">
          {items.length}
        </span>
      </div>
      <ul className="flex flex-col rounded-xl border border-border bg-card overflow-hidden">
        {items.map((r) => (
          <ReminderRowCard key={r.id} reminder={r} currentUserId={currentUserId} />
        ))}
      </ul>
    </section>
  );
}

function ReminderRowCard({
  reminder,
  currentUserId,
}: {
  reminder: ReminderRow;
  currentUserId: string;
}) {
  const due = new Date(reminder.dueAt);
  const overdue = due.getTime() < Date.now();
  const dismissed = !!reminder.dismissedAt;
  const isOwnCreator = reminder.creatorId === currentUserId;
  const isOwnRecipient = reminder.recipientId === currentUserId;

  return (
    <li className="group flex items-center gap-3 border-b border-border px-4 py-3 last:border-b-0">
      <span
        className={`grid h-9 w-9 shrink-0 place-items-center rounded-full ${
          dismissed
            ? "bg-muted text-muted-foreground"
            : overdue
              ? "bg-destructive/10 text-destructive"
              : "bg-primary/10 text-primary"
        }`}
        aria-hidden
      >
        {dismissed ? <BellOff size={14} /> : <Bell size={14} />}
      </span>

      <div className="flex min-w-0 flex-1 flex-col">
        <span className="truncate font-display text-[0.98rem] font-semibold tracking-[-0.01em]">
          {reminder.title}
        </span>
        {reminder.body && (
          <span className="truncate text-[0.86rem] text-muted-foreground">
            {reminder.body}
          </span>
        )}
        <div className="mt-1 flex flex-wrap items-center gap-2 font-mono text-[0.62rem] uppercase tracking-[0.12em] text-muted-foreground">
          <span className={`inline-flex items-center gap-1 ${overdue ? "text-destructive" : ""}`}>
            <Clock size={10} /> {formatDateTime(reminder.dueAt)}
          </span>
          {reminder.isMine && reminder.recipientName && (
            <span className="inline-flex items-center gap-1">
              <UserIcon size={10} /> dla {reminder.recipientName}
            </span>
          )}
          {!reminder.isMine && reminder.creatorName && (
            <span className="inline-flex items-center gap-1">
              <UserIcon size={10} /> od {reminder.creatorName}
            </span>
          )}
          {dismissed && <span>schowane</span>}
        </div>
      </div>

      {/* Recipient-only dismiss */}
      {isOwnRecipient && !dismissed && (
        <form
          action={(fd) => startTransition(() => dismissReminderAction(fd))}
          className="m-0"
        >
          <input type="hidden" name="id" value={reminder.id} />
          <button
            type="submit"
            aria-label="Schowaj"
            title="Schowaj (nie usuwa — twórca nadal widzi)"
            className="grid h-8 w-8 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <BellOff size={14} />
          </button>
        </form>
      )}

      {/* Creator-only delete */}
      {isOwnCreator && (
        <form
          action={(fd) => startTransition(() => deleteReminderAction(fd))}
          className="m-0"
        >
          <input type="hidden" name="id" value={reminder.id} />
          <button
            type="submit"
            aria-label="Usuń przypomnienie"
            title="Usuń przypomnienie"
            className="grid h-8 w-8 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
          >
            <Trash2 size={14} />
          </button>
        </form>
      )}
    </li>
  );
}

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString("pl-PL", { dateStyle: "medium", timeStyle: "short" });
}
