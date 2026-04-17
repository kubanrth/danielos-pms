import { createBrowserClient } from "@supabase/ssr";

// Browser client — used in Client Components for realtime + storage signed URLs.
// Anon key is safe to expose; RLS (when enabled) + Prisma-side authorization is the real guard.
export function createSupabaseBrowserClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}

// Admin client — server-only, uses service role key. Bypasses RLS.
// Never import into a Client Component or a file with "use client".
import { createClient } from "@supabase/supabase-js";

export function createSupabaseAdminClient() {
  if (typeof window !== "undefined") {
    throw new Error("Supabase admin client must not be used in the browser");
  }
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );
}
