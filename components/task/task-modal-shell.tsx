"use client";

import { useParams, useRouter } from "next/navigation";
import { X } from "lucide-react";
import { Dialog as BaseDialog } from "@base-ui/react/dialog";

// Styled wrapper around Base UI Dialog for the intercepting-route
// task modal. Closing routes back to the workspace overview
// (stable regardless of how the user arrived).
export function TaskModalShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const params = useParams();
  const workspaceId = typeof params.workspaceId === "string" ? params.workspaceId : "";

  return (
    <BaseDialog.Root
      open
      onOpenChange={(open) => {
        if (!open) router.push(`/w/${workspaceId}`);
      }}
    >
      <BaseDialog.Portal>
        <BaseDialog.Backdrop className="fixed inset-0 z-40 bg-background/70 backdrop-blur-sm data-[closed]:opacity-0 data-[open]:opacity-100" />
        <BaseDialog.Popup
          className="fixed inset-y-0 right-0 z-50 flex w-full max-w-[720px] flex-col overflow-y-auto border-l border-border bg-background shadow-[0_24px_48px_-12px_rgba(0,0,0,0.25)] data-[closed]:translate-x-full data-[open]:translate-x-0 transition-transform duration-200"
          initialFocus={undefined}
        >
          <div className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-background/95 px-8 py-3 backdrop-blur">
            <BaseDialog.Title className="eyebrow">Szczegóły zadania</BaseDialog.Title>
            <BaseDialog.Close
              className="grid h-8 w-8 place-items-center rounded-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              aria-label="Zamknij"
            >
              <X size={16} />
            </BaseDialog.Close>
          </div>
          <div className="flex-1 px-8 py-8">{children}</div>
        </BaseDialog.Popup>
      </BaseDialog.Portal>
    </BaseDialog.Root>
  );
}
