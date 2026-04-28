// Real-time sync for Kanban ↔ Table ↔ Overview within a workspace.
// Server: broadcastWorkspaceChange() fires a message on the workspace
// channel after any mutation. Client: useWorkspaceRealtime() subscribes
// to that channel and triggers a router.refresh() so server components
// re-render with the latest data.
//
// We use Supabase Realtime *broadcast* (not postgres-changes) because:
//   - No publication config / SQL required — works on any project.
//   - We have the full mutation context in the server action so we
//     can emit exactly what changed (taskId/boardId).
//   - Clients on /table and /kanban pages both listen to the same
//     channel, so drag on Kanban updates the table instantly.

import "server-only";
import { createSupabaseAdminClient } from "@/lib/supabase";

export type RealtimePayload = {
  type: "task.changed" | "board.changed";
  taskId?: string;
  boardId?: string;
  source?: string; // optional actor/session ID — suppress self-echoes
};

export async function broadcastWorkspaceChange(
  workspaceId: string,
  payload: RealtimePayload,
): Promise<void> {
  try {
    const sb = createSupabaseAdminClient();
    const channel = sb.channel(`workspace:${workspaceId}`);
    await channel.send({
      type: "broadcast",
      event: "change",
      payload,
    });
    await sb.removeChannel(channel);
  } catch (e) {
    // Don't fail the user action if realtime broadcast fails.
    console.warn("[realtime] broadcast failed:", e);
  }
}

// F12-K35: per-user broadcast — kanał `user:<userId>`. Używane do live
// powiadomień (toast w prawym górnym rogu), żeby klik nie czekał 20s
// na poll. Recipient subskrybuje przez `useUserRealtime` w
// `<UserToaster>` rendowanym z `app/(app)/layout.tsx`.
export type UserRealtimePayload =
  | {
      kind: "notification.new";
      // Notification.id — klient pobiera szczegóły przez fetch po
      // odebraniu broadcast'u.
      id: string;
    }
  | {
      kind: "reminder.due";
      // PersonalReminder.id, analogicznie.
      id: string;
    };

export async function broadcastUserChange(
  userId: string,
  payload: UserRealtimePayload,
): Promise<void> {
  try {
    const sb = createSupabaseAdminClient();
    const channel = sb.channel(`user:${userId}`);
    await channel.send({
      type: "broadcast",
      event: "change",
      payload,
    });
    await sb.removeChannel(channel);
  } catch (e) {
    console.warn("[realtime] user broadcast failed:", e);
  }
}
