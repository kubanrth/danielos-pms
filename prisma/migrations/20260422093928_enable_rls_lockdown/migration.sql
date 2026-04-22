-- F8b: defense-in-depth RLS lockdown.
--
-- Every Prisma-managed table gets Row-Level Security enabled with NO
-- policies. In Supabase's permission model that means:
--   * `postgres` role (what Prisma connects as): BYPASSRLS → unaffected.
--   * `service_role`: BYPASSRLS → unaffected (not used by this app but
--     listed for any future Supabase JS admin usage).
--   * `anon` / `authenticated`: no matching policy → access denied.
--
-- This closes a latent leak: the NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
-- exposed to the browser would otherwise let anyone SELECT from our
-- tables directly via `supabase-js`. After this migration, any
-- publishable-key client hits an empty policy set and gets nothing.
--
-- `FORCE ROW LEVEL SECURITY` is *not* used — we WANT postgres/service_role
-- to bypass. Only default behavior is enabled.

ALTER TABLE "User" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Account" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Session" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "VerificationToken" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "Workspace" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "WorkspaceMembership" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Invitation" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "Board" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "BoardView" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "StatusColumn" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "Task" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "TaskAssignee" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Tag" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "TaskTag" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "Milestone" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "Comment" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "CommentMention" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "Attachment" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "Notification" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "AuditLog" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "GlobalAuditLog" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "ProcessCanvas" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ProcessNode" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ProcessEdge" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ProcessNodeTaskLink" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "SystemFlag" ENABLE ROW LEVEL SECURITY;
