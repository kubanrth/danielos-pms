"use client";

import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import { Dialog as BaseDialog } from "@base-ui/react/dialog";

// Styled wrapper around Base UI Dialog for the intercepting-route
// task modal. Closing goes back in history so the intercepted route
// unmounts naturally. Intercepting routes only apply to soft-nav, so
// the modal is only reachable from a page that's already in history —
// router.back() is always safe here.
export function TaskModalShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();

  const close = () => router.back();

  return (
    <BaseDialog.Root
      open
      onOpenChange={(open) => {
        if (!open) close();
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
