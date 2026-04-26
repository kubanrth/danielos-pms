"use client";

// F12-K5: inline assignee + tag pickers used as table cells. Click the
// cell → portal popover with searchable list → toggle item. Mirrors the
// task-detail modal UX so users don't have to open a task just to add a
// person or tag.

import { startTransition, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { Search, UserPlus, Tag as TagIcon } from "lucide-react";
import {
  toggleAssigneeAction,
  toggleTagAction,
} from "@/app/(app)/w/[workspaceId]/t/actions";

export interface PickerMember {
  id: string;
  name: string | null;
  email: string;
  avatarUrl: string | null;
}

export interface PickerTag {
  id: string;
  name: string;
  colorHex: string;
}

// Shared positioning logic. Anchors a fixed-position popover under the
// trigger element, flipping above when clipped, and capping height so it
// stays inside the viewport.
function computeCoords(
  trigger: HTMLElement,
  desiredWidth: number,
  desiredHeight = 320,
): { top: number; left: number; maxHeight: number; placement: "below" | "above" } {
  const r = trigger.getBoundingClientRect();
  const GAP = 6;
  const margin = 8;
  const spaceBelow = window.innerHeight - r.bottom - margin;
  const spaceAbove = r.top - margin;
  const placement: "below" | "above" =
    spaceBelow >= Math.min(desiredHeight, 200) || spaceBelow >= spaceAbove ? "below" : "above";
  const left = Math.min(
    Math.max(r.left, margin),
    window.innerWidth - desiredWidth - margin,
  );
  if (placement === "below") {
    const maxHeight = Math.min(desiredHeight, spaceBelow);
    return { top: r.bottom + GAP, left, maxHeight, placement };
  }
  const maxHeight = Math.min(desiredHeight, spaceAbove);
  return { top: Math.max(margin, r.top - GAP - maxHeight), left, maxHeight, placement };
}

type Coords = ReturnType<typeof computeCoords>;

// ─────────────────────────────────────────────────────────────────────
// Assignee picker
// ─────────────────────────────────────────────────────────────────────

export function AssigneePickerCell({
  taskId,
  current,
  members,
  canEdit,
}: {
  taskId: string;
  current: PickerMember[];
  members: PickerMember[];
  canEdit: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState<Coords | null>(null);
  const [query, setQuery] = useState("");
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const close = () => {
    setOpen(false);
    setCoords(null);
    setQuery("");
  };

  const recompute = () => {
    if (!triggerRef.current) return;
    setCoords(computeCoords(triggerRef.current, 280, 360));
  };

  const onTriggerClick = () => {
    if (!canEdit) return;
    if (open) {
      close();
      return;
    }
    if (!triggerRef.current) return;
    setCoords(computeCoords(triggerRef.current, 280, 360));
    setOpen(true);
  };

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (popRef.current?.contains(e.target as Node)) return;
      if (triggerRef.current?.contains(e.target as Node)) return;
      close();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    const onReflow = () => recompute();
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    window.addEventListener("resize", onReflow);
    window.addEventListener("scroll", onReflow, true);
    setTimeout(() => inputRef.current?.focus(), 0);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", onReflow);
      window.removeEventListener("scroll", onReflow, true);
    };
  }, [open]);

  const assignedIds = new Set(current.map((m) => m.id));
  const q = query.trim().toLowerCase();
  const filtered = members.filter((m) => {
    if (!q) return true;
    const n = (m.name ?? "").toLowerCase();
    return n.includes(q) || m.email.toLowerCase().includes(q);
  });

  const toggle = (userId: string) => {
    const fd = new FormData();
    fd.set("taskId", taskId);
    fd.set("userId", userId);
    startTransition(async () => {
      await toggleAssigneeAction(fd);
      router.refresh();
    });
  };

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={onTriggerClick}
        disabled={!canEdit}
        className="group/cell flex w-full items-center gap-1 rounded-md py-1 text-left transition-colors enabled:hover:bg-accent/40 disabled:cursor-default"
        aria-label={current.length === 0 ? "Przypisz osobę" : `Przypisanych: ${current.length}`}
      >
        {current.length === 0 ? (
          <span className="inline-flex items-center gap-1.5 font-mono text-[0.66rem] uppercase tracking-[0.14em] text-muted-foreground/70 group-hover/cell:text-foreground">
            <UserPlus size={11} className="opacity-60 group-hover/cell:opacity-100" />
            przypisz
          </span>
        ) : (
          <span className="flex -space-x-1.5">
            {current.slice(0, 4).map((a) => (
              <span
                key={a.id}
                title={a.name ?? a.email}
                className="grid h-6 w-6 place-items-center overflow-hidden rounded-full border-2 border-background bg-brand-gradient font-display text-[0.6rem] font-bold text-white"
              >
                {a.avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={a.avatarUrl} alt="" className="h-full w-full object-cover" />
                ) : (
                  (a.name ?? a.email).slice(0, 2).toUpperCase()
                )}
              </span>
            ))}
            {current.length > 4 && (
              <span className="grid h-6 w-6 place-items-center rounded-full border-2 border-background bg-muted font-mono text-[0.58rem] text-muted-foreground">
                +{current.length - 4}
              </span>
            )}
          </span>
        )}
      </button>
      {open && coords && typeof document !== "undefined" &&
        createPortal(
          <div
            ref={popRef}
            style={{
              position: "fixed",
              top: coords.top,
              left: coords.left,
              width: 280,
              maxHeight: coords.maxHeight,
            }}
            className="z-[80] flex flex-col overflow-hidden rounded-xl border border-border bg-popover shadow-[0_18px_40px_-12px_rgba(10,10,40,0.3)]"
          >
            <div className="shrink-0 border-b border-border p-2">
              <div className="flex items-center gap-2 rounded-md bg-muted/40 px-2 py-1.5">
                <Search size={12} className="text-muted-foreground" />
                <input
                  ref={inputRef}
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Szukaj osoby…"
                  className="flex-1 bg-transparent text-[0.82rem] outline-none placeholder:text-muted-foreground/60"
                />
              </div>
            </div>
            <ul className="min-h-0 flex-1 overflow-y-auto p-1">
              {filtered.length === 0 && (
                <li className="px-2 py-3 text-center font-mono text-[0.62rem] uppercase tracking-[0.14em] text-muted-foreground">
                  Brak dopasowań
                </li>
              )}
              {filtered.map((m) => {
                const active = assignedIds.has(m.id);
                return (
                  <li key={m.id}>
                    <button
                      type="button"
                      onClick={() => toggle(m.id)}
                      data-active={active}
                      className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left transition-colors hover:bg-accent data-[active=true]:bg-primary/10"
                    >
                      <span className="grid h-6 w-6 shrink-0 place-items-center overflow-hidden rounded-full bg-brand-gradient font-display text-[0.6rem] font-bold text-white">
                        {m.avatarUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={m.avatarUrl} alt="" className="h-full w-full object-cover" />
                        ) : (
                          (m.name ?? m.email).slice(0, 2).toUpperCase()
                        )}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-[0.84rem]">
                        {m.name ?? m.email.split("@")[0]}
                      </span>
                      {active && (
                        <span className="font-mono text-[0.6rem] text-primary">✓</span>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>,
          document.body,
        )}
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Tag picker
// ─────────────────────────────────────────────────────────────────────

export function TagPickerCell({
  taskId,
  current,
  allTags,
  canEdit,
}: {
  taskId: string;
  current: PickerTag[];
  allTags: PickerTag[];
  canEdit: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState<Coords | null>(null);
  const [query, setQuery] = useState("");
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const close = () => {
    setOpen(false);
    setCoords(null);
    setQuery("");
  };

  const recompute = () => {
    if (!triggerRef.current) return;
    setCoords(computeCoords(triggerRef.current, 280, 360));
  };

  const onTriggerClick = () => {
    if (!canEdit) return;
    if (open) {
      close();
      return;
    }
    if (!triggerRef.current) return;
    setCoords(computeCoords(triggerRef.current, 280, 360));
    setOpen(true);
  };

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (popRef.current?.contains(e.target as Node)) return;
      if (triggerRef.current?.contains(e.target as Node)) return;
      close();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    const onReflow = () => recompute();
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    window.addEventListener("resize", onReflow);
    window.addEventListener("scroll", onReflow, true);
    setTimeout(() => inputRef.current?.focus(), 0);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", onReflow);
      window.removeEventListener("scroll", onReflow, true);
    };
  }, [open]);

  const tagIds = new Set(current.map((t) => t.id));
  const q = query.trim().toLowerCase();
  const filtered = allTags.filter((t) => !q || t.name.toLowerCase().includes(q));

  const toggle = (tagId: string) => {
    const fd = new FormData();
    fd.set("taskId", taskId);
    fd.set("tagId", tagId);
    startTransition(async () => {
      await toggleTagAction(fd);
      router.refresh();
    });
  };

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={onTriggerClick}
        disabled={!canEdit}
        className="group/cell flex w-full items-center gap-1 rounded-md py-1 text-left transition-colors enabled:hover:bg-accent/40 disabled:cursor-default"
        aria-label={current.length === 0 ? "Dodaj tag" : `Tagów: ${current.length}`}
      >
        {current.length === 0 ? (
          <span className="inline-flex items-center gap-1.5 font-mono text-[0.66rem] uppercase tracking-[0.14em] text-muted-foreground/70 group-hover/cell:text-foreground">
            <TagIcon size={11} className="opacity-60 group-hover/cell:opacity-100" />
            dodaj tag
          </span>
        ) : (
          <span className="flex flex-wrap gap-1">
            {current.map((t) => (
              <span
                key={t.id}
                className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[0.7rem] font-medium"
                style={{ background: `${t.colorHex}1A`, color: t.colorHex }}
              >
                <span
                  className="h-1.5 w-1.5 rounded-full"
                  style={{ background: t.colorHex }}
                />
                {t.name}
              </span>
            ))}
          </span>
        )}
      </button>
      {open && coords && typeof document !== "undefined" &&
        createPortal(
          <div
            ref={popRef}
            style={{
              position: "fixed",
              top: coords.top,
              left: coords.left,
              width: 280,
              maxHeight: coords.maxHeight,
            }}
            className="z-[80] flex flex-col overflow-hidden rounded-xl border border-border bg-popover shadow-[0_18px_40px_-12px_rgba(10,10,40,0.3)]"
          >
            <div className="shrink-0 border-b border-border p-2">
              <div className="flex items-center gap-2 rounded-md bg-muted/40 px-2 py-1.5">
                <Search size={12} className="text-muted-foreground" />
                <input
                  ref={inputRef}
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Szukaj tagu…"
                  className="flex-1 bg-transparent text-[0.82rem] outline-none placeholder:text-muted-foreground/60"
                />
              </div>
            </div>
            <ul className="min-h-0 flex-1 overflow-y-auto p-1">
              {filtered.length === 0 && (
                <li className="px-2 py-3 text-center font-mono text-[0.62rem] uppercase tracking-[0.14em] text-muted-foreground">
                  {allTags.length === 0
                    ? "Brak tagów — utwórz przez modal zadania"
                    : "Brak dopasowań"}
                </li>
              )}
              {filtered.map((t) => {
                const active = tagIds.has(t.id);
                return (
                  <li key={t.id}>
                    <button
                      type="button"
                      onClick={() => toggle(t.id)}
                      data-active={active}
                      className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left transition-colors hover:bg-accent data-[active=true]:bg-primary/10"
                    >
                      <span
                        className="h-2.5 w-2.5 shrink-0 rounded-full"
                        style={{ background: t.colorHex }}
                      />
                      <span className="min-w-0 flex-1 truncate text-[0.84rem]">{t.name}</span>
                      {active && (
                        <span className="font-mono text-[0.6rem] text-primary">✓</span>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>,
          document.body,
        )}
    </>
  );
}
