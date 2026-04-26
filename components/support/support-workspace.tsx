"use client";

// F11-20 (#23): support tickets workspace.
// F12-K11: rewrite z grouped cards na table view + edycja treści (title/
// description) + dueAt + isUrgent ("NATYCHMIAST") + "Zamknięte w X" duration.

import { startTransition, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  Pause,
  Pencil,
  Plus,
  Trash2,
  Zap,
} from "lucide-react";
import {
  createSupportTicketAction,
  deleteSupportTicketAction,
  updateSupportTicketAction,
} from "@/app/(app)/w/[workspaceId]/support/actions";
import { DateTimePicker } from "@/components/ui/date-time-picker";
import { formatDuration } from "@/lib/format-duration";

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
  // F12-K11: deadline / NATYCHMIAST flag.
  dueAt: string | null;
  isUrgent: boolean;
  createdAt: string;
  resolvedAt: string | null;
  reporter: { id: string; name: string | null; email: string; avatarUrl: string | null };
  assignee: { id: string; name: string | null; email: string; avatarUrl: string | null } | null;
}

const STATUS_META: Record<Status, { label: string; color: string; icon: typeof Clock }> = {
  OPEN: { label: "Nowe", color: "#3B82F6", icon: AlertCircle },
  IN_PROGRESS: { label: "W toku", color: "#F59E0B", icon: Clock },
  RESOLVED: { label: "Rozwiązane", color: "#10B981", icon: CheckCircle2 },
  CLOSED: { label: "Zamknięte", color: "#64748B", icon: Pause },
};

const PRIORITY_META: Record<Priority, { label: string; color: string }> = {
  LOW: { label: "Niski", color: "#94A3B8" },
  MEDIUM: { label: "Średni", color: "#3B82F6" },
  HIGH: { label: "Wysoki", color: "#F59E0B" },
  URGENT: { label: "Pilny", color: "#EF4444" },
};

const STATUSES: Status[] = ["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"];
const PRIORITIES: Priority[] = ["LOW", "MEDIUM", "HIGH", "URGENT"];

function isClosed(s: Status): boolean {
  return s === "RESOLVED" || s === "CLOSED";
}

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
  const [editing, setEditing] = useState<SupportTicketRow | null>(null);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <span className="eyebrow">Wsparcie</span>
        <h1 className="font-display text-[2.2rem] font-bold leading-[1.1] tracking-[-0.03em]">
          <span className="text-brand-gradient">Support</span> — zgłoszenia.
        </h1>
        <p className="max-w-[60ch] text-[0.95rem] leading-[1.55] text-muted-foreground">
          Zgłoś temat wymagający supportu. Admini przestrzeni przypisują
          osobę odpowiedzialną i zamykają zgłoszenia. Statusy: nowe → w toku → rozwiązane → zamknięte.
        </p>
      </div>

      <NewTicketForm workspaceId={workspaceId} />

      {tickets.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-muted/20 p-8 text-center">
          <p className="font-display text-[1rem] font-semibold">Brak zgłoszeń.</p>
          <p className="mt-1 text-[0.88rem] text-muted-foreground">
            Wciśnij „Nowe zgłoszenie", żeby dodać pierwszy ticket.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-card shadow-[0_1px_2px_rgba(10,10,40,0.04)]">
          <div className="overflow-x-auto">
            <table className="w-full text-[0.88rem]">
              <thead>
                <tr className="border-b border-border bg-muted/40">
                  <Th>Tytuł</Th>
                  <Th width={140}>Status</Th>
                  <Th width={120}>Priorytet</Th>
                  <Th width={170}>Termin</Th>
                  <Th width={150}>Zgłaszający</Th>
                  <Th width={170}>Odpowiedzialny</Th>
                  <Th width={170}>Zamknięte w</Th>
                  <Th width={90} align="right">Akcje</Th>
                </tr>
              </thead>
              <tbody>
                {tickets.map((t) => (
                  <TicketRow
                    key={t.id}
                    ticket={t}
                    members={members}
                    canManage={canManage}
                    currentUserId={currentUserId}
                    onEdit={() => setEditing(t)}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {editing && (
        <EditTicketDialog
          ticket={editing}
          canManage={canManage}
          currentUserId={currentUserId}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}

function Th({
  children,
  width,
  align,
}: {
  children: React.ReactNode;
  width?: number;
  align?: "left" | "right";
}) {
  return (
    <th
      className={`h-10 px-4 font-mono text-[0.62rem] font-semibold uppercase tracking-[0.14em] text-muted-foreground ${
        align === "right" ? "text-right" : "text-left"
      }`}
      style={width ? { width: `${width}px` } : undefined}
    >
      {children}
    </th>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Row
// ─────────────────────────────────────────────────────────────────────

function TicketRow({
  ticket,
  members,
  canManage,
  currentUserId,
  onEdit,
}: {
  ticket: SupportTicketRow;
  members: SupportMember[];
  canManage: boolean;
  currentUserId: string;
  onEdit: () => void;
}) {
  const StatusIcon = STATUS_META[ticket.status].icon;
  const statusColor = STATUS_META[ticket.status].color;
  const priorityColor = PRIORITY_META[ticket.priority].color;
  const isReporter = ticket.reporter.id === currentUserId;
  // Reporter może edytować dopóki status=OPEN i nikt nie przypisany;
  // admin (canManage) zawsze.
  const canEditContent =
    canManage || (isReporter && ticket.status === "OPEN" && !ticket.assignee);

  const ticketClosed = isClosed(ticket.status);
  const closedDuration =
    ticketClosed && ticket.resolvedAt
      ? formatDuration(ticket.createdAt, ticket.resolvedAt)
      : null;

  return (
    <tr className="border-b border-border last:border-b-0 align-middle hover:bg-accent/30">
      {/* Tytuł */}
      <td className="px-4 py-3">
        <button
          type="button"
          onClick={onEdit}
          className="block w-full text-left font-display text-[0.95rem] font-semibold leading-tight tracking-[-0.01em] hover:text-primary"
        >
          {ticket.title}
        </button>
        {ticket.description && (
          <p className="mt-0.5 line-clamp-1 text-[0.78rem] text-muted-foreground">
            {ticket.description}
          </p>
        )}
      </td>

      {/* Status */}
      <td className="px-4 py-3">
        {canManage ? (
          <StatusSelect
            ticketId={ticket.id}
            current={ticket.status}
          />
        ) : (
          <span
            className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[0.72rem] font-medium"
            style={{ background: `${statusColor}1A`, color: statusColor }}
          >
            <StatusIcon size={11} />
            {STATUS_META[ticket.status].label}
          </span>
        )}
      </td>

      {/* Priorytet */}
      <td className="px-4 py-3">
        {canManage ? (
          <PrioritySelect ticketId={ticket.id} current={ticket.priority} />
        ) : (
          <span
            className="inline-flex items-center rounded-full px-2 py-0.5 text-[0.72rem] font-medium"
            style={{ background: `${priorityColor}1A`, color: priorityColor }}
          >
            {PRIORITY_META[ticket.priority].label}
          </span>
        )}
      </td>

      {/* Termin */}
      <td className="px-4 py-3">
        <DueCell ticket={ticket} canEdit={canEditContent} />
      </td>

      {/* Zgłaszający */}
      <td className="px-4 py-3">
        <PersonChip person={ticket.reporter} />
      </td>

      {/* Odpowiedzialny */}
      <td className="px-4 py-3">
        {canManage ? (
          <AssigneeSelect ticketId={ticket.id} current={ticket.assignee} members={members} />
        ) : ticket.assignee ? (
          <PersonChip person={ticket.assignee} />
        ) : (
          <MutedDash />
        )}
      </td>

      {/* Zamknięte w */}
      <td className="px-4 py-3">
        {closedDuration ? (
          <span className="font-mono text-[0.78rem] text-muted-foreground">
            {closedDuration}
          </span>
        ) : (
          <MutedDash />
        )}
      </td>

      {/* Akcje */}
      <td className="px-4 py-3 text-right">
        <div className="inline-flex items-center gap-1">
          {canEditContent && (
            <button
              type="button"
              onClick={onEdit}
              aria-label="Edytuj zgłoszenie"
              title="Edytuj"
              className="grid h-7 w-7 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              <Pencil size={12} />
            </button>
          )}
          {canManage && (
            <DeleteButton ticketId={ticket.id} title={ticket.title} />
          )}
        </div>
      </td>
    </tr>
  );
}

function MutedDash() {
  return <span className="font-mono text-[0.7rem] text-muted-foreground/60">—</span>;
}

function PersonChip({
  person,
}: {
  person: { name: string | null; email: string; avatarUrl: string | null };
}) {
  return (
    <span className="flex items-center gap-2 min-w-0">
      <span className="grid h-6 w-6 shrink-0 place-items-center overflow-hidden rounded-full bg-brand-gradient font-display text-[0.6rem] font-bold text-white">
        {person.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={person.avatarUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          (person.name ?? person.email).slice(0, 2).toUpperCase()
        )}
      </span>
      <span className="min-w-0 truncate text-[0.84rem]">
        {person.name ?? person.email.split("@")[0]}
      </span>
    </span>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Inline cell editors
// ─────────────────────────────────────────────────────────────────────

function StatusSelect({ ticketId, current }: { ticketId: string; current: Status }) {
  const meta = STATUS_META[current];
  const Icon = meta.icon;
  return (
    <span
      className="relative inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[0.72rem] font-medium"
      style={{ background: `${meta.color}1A`, color: meta.color }}
    >
      <Icon size={11} />
      {meta.label}
      <select
        value={current}
        onChange={(e) => {
          const fd = new FormData();
          fd.set("id", ticketId);
          fd.set("status", e.target.value);
          startTransition(() => updateSupportTicketAction(fd));
        }}
        aria-label="Zmień status"
        className="absolute inset-0 cursor-pointer opacity-0"
      >
        {STATUSES.map((s) => (
          <option key={s} value={s}>
            {STATUS_META[s].label}
          </option>
        ))}
      </select>
    </span>
  );
}

function PrioritySelect({ ticketId, current }: { ticketId: string; current: Priority }) {
  const meta = PRIORITY_META[current];
  return (
    <span
      className="relative inline-flex items-center rounded-full px-2 py-0.5 text-[0.72rem] font-medium"
      style={{ background: `${meta.color}1A`, color: meta.color }}
    >
      {meta.label}
      <select
        value={current}
        onChange={(e) => {
          const fd = new FormData();
          fd.set("id", ticketId);
          fd.set("priority", e.target.value);
          startTransition(() => updateSupportTicketAction(fd));
        }}
        aria-label="Zmień priorytet"
        className="absolute inset-0 cursor-pointer opacity-0"
      >
        {PRIORITIES.map((p) => (
          <option key={p} value={p}>
            {PRIORITY_META[p].label}
          </option>
        ))}
      </select>
    </span>
  );
}

function AssigneeSelect({
  ticketId,
  current,
  members,
}: {
  ticketId: string;
  current: SupportTicketRow["assignee"];
  members: SupportMember[];
}) {
  return (
    <span className="relative inline-flex w-full items-center gap-2">
      {current ? (
        <PersonChip person={current} />
      ) : (
        <span className="font-mono text-[0.7rem] uppercase tracking-[0.14em] text-muted-foreground/70">
          + przypisz
        </span>
      )}
      <select
        value={current?.id ?? ""}
        onChange={(e) => {
          const fd = new FormData();
          fd.set("id", ticketId);
          fd.set("assigneeId", e.target.value);
          startTransition(() => updateSupportTicketAction(fd));
        }}
        aria-label="Przypisz osobę"
        className="absolute inset-0 cursor-pointer opacity-0"
      >
        <option value="">— brak —</option>
        {members.map((m) => (
          <option key={m.id} value={m.id}>
            {m.name ?? m.email}
          </option>
        ))}
      </select>
    </span>
  );
}

function DueCell({ ticket, canEdit }: { ticket: SupportTicketRow; canEdit: boolean }) {
  // F12-K11: trzy stany — NATYCHMIAST (czerwony badge), data (formatted),
  // brak ("—" + opcjonalnie ustaw). isUrgent wyklucza dueAt.
  if (ticket.isUrgent) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-md border border-destructive/40 bg-destructive/10 px-2 py-1 font-mono text-[0.7rem] font-semibold uppercase tracking-[0.14em] text-destructive">
        <Zap size={11} /> NATYCHMIAST
        {canEdit && (
          <button
            type="button"
            onClick={() => {
              const fd = new FormData();
              fd.set("id", ticket.id);
              fd.set("isUrgent", "false");
              startTransition(() => updateSupportTicketAction(fd));
            }}
            aria-label="Wyłącz NATYCHMIAST"
            title="Wyłącz NATYCHMIAST"
            className="ml-1 grid h-4 w-4 place-items-center rounded text-destructive/70 transition-colors hover:bg-destructive/20 hover:text-destructive"
          >
            ×
          </button>
        )}
      </span>
    );
  }

  if (!canEdit) {
    return ticket.dueAt ? (
      <span className="font-mono text-[0.78rem]">
        {new Date(ticket.dueAt).toLocaleString("pl-PL", {
          day: "numeric",
          month: "short",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        })}
      </span>
    ) : (
      <MutedDash />
    );
  }

  return (
    <div className="flex items-center gap-1.5">
      <DateTimePicker
        name="dueAt"
        defaultValue={ticket.dueAt}
        variant="cell"
        placeholder="Brak terminu"
        onChange={(iso) => {
          const fd = new FormData();
          fd.set("id", ticket.id);
          fd.set("dueAt", iso);
          startTransition(() => updateSupportTicketAction(fd));
        }}
      />
      <button
        type="button"
        onClick={() => {
          const fd = new FormData();
          fd.set("id", ticket.id);
          fd.set("isUrgent", "true");
          startTransition(() => updateSupportTicketAction(fd));
        }}
        aria-label="Oznacz jako NATYCHMIAST"
        title="NATYCHMIAST"
        className="grid h-7 w-7 shrink-0 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
      >
        <Zap size={12} />
      </button>
    </div>
  );
}

function DeleteButton({ ticketId, title }: { ticketId: string; title: string }) {
  return (
    <form
      action={(fd) => {
        if (!confirm(`Usunąć zgłoszenie „${title}"? Tego nie da się cofnąć.`)) return;
        startTransition(() => deleteSupportTicketAction(fd));
      }}
      className="m-0 inline"
    >
      <input type="hidden" name="id" value={ticketId} />
      <button
        type="submit"
        aria-label="Usuń zgłoszenie"
        title="Usuń"
        className="grid h-7 w-7 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
      >
        <Trash2 size={12} />
      </button>
    </form>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Edit dialog (title + description)
// ─────────────────────────────────────────────────────────────────────

function EditTicketDialog({
  ticket,
  canManage,
  currentUserId,
  onClose,
}: {
  ticket: SupportTicketRow;
  canManage: boolean;
  currentUserId: string;
  onClose: () => void;
}) {
  const isReporter = ticket.reporter.id === currentUserId;
  const canEditContent =
    canManage || (isReporter && ticket.status === "OPEN" && !ticket.assignee);
  const [title, setTitle] = useState(ticket.title);
  const [description, setDescription] = useState(ticket.description);

  const submit = () => {
    if (!canEditContent) {
      onClose();
      return;
    }
    const fd = new FormData();
    fd.set("id", ticket.id);
    if (title.trim() !== ticket.title) fd.set("title", title.trim());
    if (description.trim() !== ticket.description) fd.set("description", description.trim());
    startTransition(async () => {
      await updateSupportTicketAction(fd);
      onClose();
    });
  };

  return (
    <div
      className="fixed inset-0 z-[80] grid place-items-center bg-black/40 px-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="flex w-full max-w-[560px] flex-col gap-4 rounded-xl border border-border bg-popover p-6 shadow-[0_18px_40px_-12px_rgba(10,10,40,0.4)]">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <span className="eyebrow">Zgłoszenie</span>
            <p className="mt-1 font-mono text-[0.64rem] uppercase tracking-[0.14em] text-muted-foreground">
              utworzone {new Date(ticket.createdAt).toLocaleString("pl-PL")}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid h-7 w-7 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            aria-label="Zamknij"
          >
            ×
          </button>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="eyebrow">Tytuł</label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            disabled={!canEditContent}
            maxLength={200}
            className="h-10 rounded-md border border-border bg-background px-3 text-[0.95rem] outline-none focus:border-primary disabled:opacity-60"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="eyebrow">Opis</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            disabled={!canEditContent}
            rows={6}
            maxLength={5000}
            className="min-h-[140px] resize-y rounded-md border border-border bg-background p-3 text-[0.9rem] outline-none focus:border-primary disabled:opacity-60"
          />
        </div>

        {!canEditContent && (
          <p className="font-mono text-[0.66rem] uppercase tracking-[0.14em] text-muted-foreground/80">
            Edycja zablokowana — zgłoszenie zostało przypisane lub zamknięte.
            Tylko admin może je dalej zmieniać.
          </p>
        )}

        <div className="flex items-center justify-end gap-3 border-t border-border pt-4">
          <button
            type="button"
            onClick={onClose}
            className="font-mono text-[0.72rem] uppercase tracking-[0.14em] text-muted-foreground transition-colors hover:text-foreground"
          >
            {canEditContent ? "Anuluj" : "Zamknij"}
          </button>
          {canEditContent && (
            <button
              type="button"
              onClick={submit}
              disabled={!title.trim() || !description.trim()}
              className="inline-flex h-9 items-center justify-center rounded-md bg-brand-gradient px-4 font-sans text-[0.86rem] font-semibold text-white shadow-brand transition-[transform,opacity] hover:-translate-y-[1px] disabled:opacity-60"
            >
              Zapisz zmiany
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// New ticket form
// ─────────────────────────────────────────────────────────────────────

function NewTicketForm({ workspaceId }: { workspaceId: string }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<Priority>("MEDIUM");
  const [isUrgent, setIsUrgent] = useState(false);
  const [dueAt, setDueAt] = useState<string>("");

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
          setIsUrgent(false);
          setDueAt("");
        })
      }
      className="flex flex-col gap-4 rounded-xl border border-primary/40 bg-primary/5 p-5"
    >
      <input type="hidden" name="workspaceId" value={workspaceId} />
      <input type="hidden" name="priority" value={priority} />
      <input type="hidden" name="isUrgent" value={isUrgent ? "true" : "false"} />
      <input type="hidden" name="dueAt" value={isUrgent ? "" : dueAt} />

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
        {PRIORITIES.map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => setPriority(p)}
            className={`h-7 rounded-full border px-3 font-mono text-[0.66rem] uppercase tracking-[0.14em] transition-colors ${
              priority === p
                ? "border-transparent text-white"
                : "border-border text-muted-foreground hover:text-foreground"
            }`}
            style={priority === p ? { background: PRIORITY_META[p].color } : undefined}
          >
            {PRIORITY_META[p].label}
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-2">
        <span className="eyebrow">Kiedy potrzebujesz tego rozwiązanego?</span>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setIsUrgent((v) => !v)}
            data-active={isUrgent}
            className="inline-flex h-9 items-center gap-1.5 rounded-md border border-border bg-background px-3 font-mono text-[0.7rem] uppercase tracking-[0.14em] text-muted-foreground transition-colors hover:border-destructive/60 hover:text-destructive data-[active=true]:border-destructive data-[active=true]:bg-destructive/10 data-[active=true]:text-destructive"
          >
            <Zap size={12} /> NATYCHMIAST
          </button>
          {!isUrgent && (
            <div className="min-w-[260px] flex-1">
              <DateTimePicker
                name="__dueAtPicker"
                defaultValue={dueAt || null}
                placeholder="Brak konkretnej daty"
                onChange={(iso) => setDueAt(iso)}
              />
            </div>
          )}
        </div>
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
