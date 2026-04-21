"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase";

// Subscribe to the workspace channel and trigger a router.refresh()
// on any broadcast. Server components re-render with fresh data and
// the client state in useState resyncs via the useEffect sentinel in
// KanbanBoard / BoardTable.
export function useWorkspaceRealtime(workspaceId: string) {
  const router = useRouter();

  useEffect(() => {
    if (!workspaceId) return;
    const sb = createSupabaseBrowserClient();
    const channel = sb.channel(`workspace:${workspaceId}`);

    // Small debounce — rapid back-to-back mutations from a single drag
    // shouldn't trigger N refreshes.
    let pending: ReturnType<typeof setTimeout> | null = null;
    const scheduleRefresh = () => {
      if (pending) clearTimeout(pending);
      pending = setTimeout(() => {
        router.refresh();
        pending = null;
      }, 150);
    };

    channel
      .on("broadcast", { event: "change" }, () => {
        scheduleRefresh();
      })
      .subscribe();

    return () => {
      if (pending) clearTimeout(pending);
      sb.removeChannel(channel);
    };
  }, [workspaceId, router]);
}
