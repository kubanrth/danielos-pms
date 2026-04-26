"use client";

// F11-20 (#23): support tickets workspace — table view + create form.

import { startTransition, useState } from "react";
import { AlertCircle, CheckCircle2, Clock, Pause, Plus, Trash2 } from "lucide-react";
import {
  createSupportTicketAction,
  deleteSupportTicketAction,
  updateSupportTicketAction,
} from "@/app/(app)/w/[workspaceId]/support/actions";

type Status = "OPEN" | "IN_PROGRESS" | "RESOLVED" | "CLOSED";
type Priority = "LOW" | "MEDIUM" | "HIGH" | "URGENT";

export interface SupportMember {
  id: string;
  name: string | null;
  email: string;
  avatarUrl: string | null;
}

export interface SupportTicketRow {
  id: string;
  title: string;
  description: string;
  status: Status;
  priority: Priority;
  createdAt: string;
  resolvedAt: string | null;
  reporter: { id: string; name: string | null; email: string };
  assignee: { id: string; name: string | null; email: string } | null;
}

const STATUS_META: Record<Status, { label: string; color: string; icon: typeof Clock }> = {
  OPEN: { label: "Nowy", color: "#3B82F6", icon: AlertCircle },
  IN_PROGRESS: { label: "W toku", color: "#F59E0B", icon: Clock },
  RESOLVED: { label: "Rozwiązany", color: "#10B981", icon: CheckCircle2 },
  CLOSED: { label: "Zamknięty", color: "#64748B", icon: Pause },
};

const PRIORITY_META: Record<Priority, { label: string; color: string }> = {
  LOW: { label: "Niski", color: "#94A3B8" },
  MEDIUM: { label: "Średni", color: "#3B82F6" },
  HIGH: { label: "Wysoki", color: "#F59E0B" },
  URGENT: { label: "Pilny", color: "#EF4444" },
};

export function SupportWorkspace({
  workspaceId,
  currentUserId,
  canManage,
  tickets,
  members,
}: {
  workspaceId: string;
  currentUserId: string;
  canManage: boolean;
  tickets: SupportTicketRow[];
  members: SupportMember[];
}) {
  const open = tickets.filter((t) => t.status === "OPEN" || t.status === "IN_PROGRESS");
  const closed = tickets.filter((t) => t.status === "RESOLVED" || t.status === "CLOSED");

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <span className="eyebrow">Wsparcie</span>
        <h1 className="font-display text-[2.2rem] font-bold leading-[1.1] tracking-[-0.03em]">
          <span className="text-brand-gradient">Support</span> — zgłoszenia.
        </h1>
        <p className="max-w-[60ch] text-[0.95rem] leading-[1.55] text-muted-foreground">
          Zgłoś temat wymagający supportu. Admini przestrzeni widzą
          wszystkie zgłoszenia i przypisują się do nich. Statusy: nowy →
          w toku → rozwiązany.
        </p>
      </div>

      <NewTicketForm workspaceId={workspaceId} />

      <Section
        title="Otwarte"
        items={open}
        members={members}
        canManage={canManage}
        currentUserId={currentUserId}
      />
      <Section
        title="Zamknięte"
        items={closed}
        members={members}
        canManage={canManage}
        currentUserId={currentUserId}
      />
    </div>
  );
}

function NewTicketForm({ workspaceId }: { workspaceId: string }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<Priority>("MEDIUM");

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex h-10 w-fit items-center gap-2 rounded-lg bg-brand-gradient px-4 font-sans text-[0.9rem] font-semibold text-white shadow-brand transition-[transform,opacity] hover:-translate-y-[1px]"
      >
        <Plus size={14} /> Nowe zgłoszenie
      </button>
    );
  }

  return (
    <form
      action={(fd) =>
        startTransition(async () => {
          await createSupportTicketAction(fd);
          setOpen(false);
          setTitle("");
          setDescription("");
          setPriority("MEDIUM");
        })
      }
      className="flex flex-col gap-4 rounded-xl border border-primary/40 bg-primary/5 p-5"
    >
      <input type="hidden" name="workspaceId" value={workspaceId} />
      <input type="hidden" name="priority" value={priority} />
      <div className="flex flex-col gap-1.5">
        <span className="eyebrow">Temat</span>
        <input
          name="title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
          autoFocus
          maxLength={200}
          placeholder="Krótko o co chodzi"
          className="h-10 border-b border-border bg-transparent pb-1 font-display text-[1.1rem] outline-none focus:border-primary"
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <span className="eyebrow">Opis</span>
        <textarea
          name="description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          required
          rows={4}
          maxLength={5000}
          placeholder="Co się dzieje, jakich kroków oczekujesz, co już próbowałeś…"
          className="min-h-[100px] resize-y rounded-md border border-border bg-background p-2 text-[0.9rem] outline-none focus:border-primary"
        />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <span className="eyebrow">Priorytet:</span>
        {(["LOW", "MEDIUM", "HIGH", "URGENT"] as const).map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => setPriority(p)}
            className={`h-7 rounded-full border px-3 font-mono text-[0.66rem] uppercase tracking-[0.14em] transition-colors ${
              priority === p
                ? "border-transparent text-white"
                : "border-border text-muted-foreground hover:text-foreground"
            }`}
            style={
              priority === p
                ? { background: PRIORITY_META[p].color }
                : undefined
            }
          >
            {PRIORITY_META[p].label}
          </button>
        ))}
      </div>
      <div className="flex items-center justify-end gap-3">
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="font-mono text-[0.72rem] uppercase tracking-[0.14em] text-muted-foreground hover:text-foreground"
        >
          Anuluj
        </button>
        <button
          type="submit"
          className="inline-flex h-10 items-center justify-center rounded-lg bg-brand-gradient px-5 font-sans text-[0.9rem] font-semibold text-white shadow-brand transition-[transform,opacity] hover:-translate-y-[1px]"
        >
          Zgłoś
        </button>
      </div>
    </form>
  );
}

function Section({
  title,
  items,
  members,
  canManage,
  currentUserId,
}: {
  title: string;
  items: SupportTicketRow[];
  members: SupportMember[];
  canManage: boolean;
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
      <ul className="flex flex-col gap-2">
        {items.map((t) => (
          <TicketCard
            key={t.id}
            ticket={t}
            members={members}
            canManage={canManage}
            currentUserId={currentUserId}
          />
        ))}
      </ul>
    </section>
  );
}

function TicketCard({
  ticket,
  members,
  canManage,
  currentUserId,
}: {
  ticket: SupportTicketRow;
  members: SupportMember[];
  canManage: boolean;
  currentUserId: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const StatusIcon = STATUS_META[ticket.status].icon;
  const statusColor = STATUS_META[ticket.status].color;
  const priorityColor = PRIORITY_META[ticket.priority].color;
  const isReporter = ticket.reporter.id === currentUserId;

  return (
    <li className="flex flex-col gap-2 rounded-xl border border-border bg-card p-4">
      <div className="flex items-start gap-3">
        <span
          className="grid h-8 w-8 shrink-0 place-items-center rounded-full"
          style={{ background: `${statusColor}1A`, color: statusColor }}
          aria-hidden
        >
          <StatusIcon size={14} />
        </span>
        <div className="flex min-w-0 flex-1 flex-col">
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="text-left font-display text-[1rem] font-semibold leading-tight tracking-[-0.01em] hover:text-primary"
          >
            {ticket.title}
          </button>
          <div className="mt-1 flex flex-wrap items-center gap-2 font-mono text-[0.62rem] uppercase tracking-[0.12em] text-muted-foreground">
            <span style={{ color: statusColor }}>
              {STATUS_META[ticket.status].label}
            </span>
            <span style={{ color: priorityColor }}>
              · {PRIORITY_META[ticket.priority].label}
            </span>
            <span>· od {ticket.reporter.name ?? ticket.reporter.email}</span>
            <span>· {new Date(ticket.createdAt).toLocaleDateString("pl-PL")}</span>
            {ticket.assignee && (
              <span>
                · obsługuje: {ticket.assignee.name ?? ticket.assignee.email}
              </span>
            )}
          </div>
        </div>
        {(canManage || isReporter) && (
          <form
            action={(fd) => startTransition(() => deleteSupportTicketAction(fd))}
            className="m-0"
          >
            <input type="hidden" name="id" value={ticket.id} />
            <button
              type="submit"
              aria-label="Usuń"
              className="grid h-8 w-8 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
            >
              <Trash2 size={13} />
            </button>
          </form>
        )}
      </div>

      {expanded && (
        <div className="flex flex-col gap-3 rounded-lg border border-border bg-background p-3">
          <p className="whitespace-pre-wrap text-[0.92rem] leading-[1.55] text-foreground">
            {ticket.description}
          </p>
          {canManage && (
            <div className="flex flex-wrap items-center gap-2 border-t border-border pt-3">
              <StatusSelect ticketId={ticket.id} value={ticket.status} />
              <PrioritySelect ticketId={ticket.id} value={ticket.priority} />
              <AssigneeSelect
                ticketId={ticket.id}
                value={ticket.assignee?.id ?? ""}
                members={members}
              />
            </div>
          )}
        </div>
      )}
    </li>
  );
}

function StatusSelect({ ticketId, value }: { ticketId: string; value: Status }) {
  return (
    <form
      action={(fd) => startTransition(() => updateSupportTicketAction(fd))}
      className="m-0"
    >
      <input type="hidden" name="id" value={ticketId} />
      <select
        name="status"
        defaultValue={value}
        onChange={(e) => (e.currentTarget.form as HTMLFormElement).requestSubmit()}
        className="h-8 rounded-md border border-border bg-background px-2 font-mono text-[0.66rem] uppercase tracking-[0.12em] outline-none focus:border-primary"
      >
        {(Object.keys(STATUS_META) as Status[]).map((s) => (
          <option key={s} value={s}>
            {STATUS_META[s].label}
          </option>
        ))}
      </select>
    </form>
  );
}

function PrioritySelect({ ticketId, value }: { ticketId: string; value: Priority }) {
  return (
    <form
      action={(fd) => startTransition(() => updateSupportTicketAction(fd))}
      className="m-0"
    >
      <input type="hidden" name="id" value={ticketId} />
      <select
        name="priority"
        defaultValue={value}
        onChange={(e) => (e.currentTarget.form as HTMLFormElement).requestSubmit()}
        className="h-8 rounded-md border border-border bg-background px-2 font-mono text-[0.66rem] uppercase tracking-[0.12em] outline-none focus:border-primary"
      >
        {(Object.keys(PRIORITY_META) as Priority[]).map((p) => (
          <option key={p} value={p}>
            {PRIORITY_META[p].label}
          </option>
        ))}
      </select>
    </form>
  );
}

function AssigneeSelect({
  ticketId,
  value,
  members,
}: {
  ticketId: string;
  value: string;
  members: SupportMember[];
}) {
  return (
    <form
      action={(fd) => startTransition(() => updateSupportTicketAction(fd))}
      className="m-0"
    >
      <input type="hidden" name="id" value={ticketId} />
      <select
        name="assigneeId"
        defaultValue={value}
        onChange={(e) => (e.currentTarget.form as HTMLFormElement).requestSubmit()}
        className="h-8 rounded-md border border-border bg-background px-2 font-mono text-[0.66rem] outline-none focus:border-primary"
      >
        <option value="">— nieprzypisany —</option>
        {members.map((m) => (
          <option key={m.id} value={m.id}>
            {m.name ?? m.email}
          </option>
        ))}
      </select>
    </form>
  );
}
