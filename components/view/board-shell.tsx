import type { ReactNode } from "react";

// Shared outer shell for all 5 board-level views (table/kanban/roadmap/
// gantt/whiteboard). Guarantees identical viewport width, padding, and
// background handling so switching views doesn't "shift" the layout.
//
// Inner frame is fixed at max-w-[1400px] — widest of the original per-view
// widths — so content never jumps between views.
export function BoardShell({
  bgCss,
  children,
}: {
  bgCss: string | null | undefined;
  children: ReactNode;
}) {
  return (
    <div
      className="relative -mx-4 -my-5 min-h-[calc(100dvh-14rem)] px-4 py-5 md:-mx-14 md:-my-10 md:px-14 md:py-10"
      style={bgCss ? { background: bgCss } : undefined}
    >
      <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-4 md:gap-6">
        {children}
      </div>
    </div>
  );
}
