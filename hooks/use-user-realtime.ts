"use client";

import { useEffect } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase";
import type { UserRealtimePayload } from "@/lib/realtime";

// F12-K35: per-user kanał `user:<userId>` — subskrybuje broadcastUserChange'y
// (notification.new / reminder.due). Używane przez `<UserToaster>` żeby
// pokazać toast w prawym górnym rogu od razu, bez polla.
//
// W przeciwieństwie do `useWorkspaceRealtime`, nie odpalamy `router.refresh()`
// — toaster sam fetchuje payload po id. Refresh inboxa jest osobno (przez
// revalidatePath('/inbox') po stronie servera).
export function useUserRealtime(
  userId: string | null | undefined,
  onChange: (payload: UserRealtimePayload) => void,
) {
  useEffect(() => {
    if (!userId) return;
    const sb = createSupabaseBrowserClient();
    const channel = sb.channel(`user:${userId}`);

    channel
      .on("broadcast", { event: "change" }, (msg) => {
        const payload = msg.payload as UserRealtimePayload | undefined;
        if (!payload) return;
        onChange(payload);
      })
      .subscribe();

    return () => {
      sb.removeChannel(channel);
    };
    // onChange jest stabilny przez useCallback w consumerze — nie chcemy
    // resubscribe'ować przy każdym renderze.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);
}
