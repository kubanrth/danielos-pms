"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import { Dialog as BaseDialog } from "@base-ui/react/dialog";

// Styled wrapper around Base UI Dialog for the intercepting-route
// task modal. Closing goes back in history so the intercepted route
// unmounts naturally. Intercepting routes only apply to soft-nav, so
// the modal is only reachable from a page that's already in history —
// router.back() is always safe here.
//
// Jeśli sessionStorage ma 'taskModalReturnTo' (ustawione przez
// CreateTaskButton przy create flow), wracamy do tej konkretnej strony
// zamiast router.back. Bez tego close po Nowe Zadanie wracał do
// workspace overview ("O projekcie") zamiast do np. table/kanban view
// skąd user kliknął przycisk.
//
// Prop `open` był wcześniej forced=true bez state. Klik X wołał
// onOpenChange(false), close() startował navigację, ale prop nadal był
// true — Base UI nie zamykał dialog'u wizualnie. Wyglądało jakby trzeba
// było kliknąć 2×. Teraz controlled state `open` — pierwsza akcja
// natychmiast zamyka UI, potem nawigacja.
export function TaskModalShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [open, setOpen] = useState(true);
  // B: idempotency guard. close() leciał 2× przy jednym klik'u X:
  // - 1: onClick handler na buttonie X
  // - 2: setOpen(false) → BaseDialog re-render → onOpenChange(false) → close()
  // Pierwsza wywołka czytała sessionStorage + nawigowała. Druga miała już
  // empty storage → router.back() → przeskakiwała o dodatkowy poziom
  // (klient lądował na /workspaces zamiast na board view).
  const closingRef = useRef(false);

  const close = () => {
    if (closingRef.current) return;
    closingRef.current = true;
    setOpen(false);
    let returnTo: string | null = null;
    try {
      returnTo = sessionStorage.getItem("taskModalReturnTo");
      sessionStorage.removeItem("taskModalReturnTo");
    } catch {
      /* sessionStorage off — fallback to back */
    }
    if (returnTo) {
      router.push(returnTo);
    } else {
      router.back();
    }
  };

  return (
    <BaseDialog.Root
      open={open}
      onOpenChange={(next) => {
        if (!next) close();
      }}
    >
      <BaseDialog.Portal>
        <BaseDialog.Backdrop className="fixed inset-0 z-40 bg-background/70 backdrop-blur-sm data-[closed]:opacity-0 data-[open]:opacity-100" />
        <BaseDialog.Popup
          className="fixed inset-y-0 right-0 z-50 flex w-full max-w-[720px] flex-col overflow-y-auto border-l border-border bg-background shadow-[0_24px_48px_-12px_rgba(0,0,0,0.25)] data-[closed]:translate-x-full data-[open]:translate-x-0 transition-transform duration-200"
          initialFocus={undefined}
        >
          {/* F12-K41: padding sm:px-8 — na mobile (~360-400px szerokości
              drawer = full width) px-8 było za szerokie. */}
          <div className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-background/95 px-4 py-3 backdrop-blur sm:px-8">
            <BaseDialog.Title className="eyebrow">Szczegóły zadania</BaseDialog.Title>
            <button
              type="button"
              onClick={close}
              className="grid h-9 w-9 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              aria-label="Zamknij"
            >
              <X size={18} />
            </button>
          </div>
          <div className="flex-1 px-4 py-6 sm:px-8 sm:py-8">{children}</div>
        </BaseDialog.Popup>
      </BaseDialog.Portal>
    </BaseDialog.Root>
  );
}
