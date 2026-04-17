import { createBrowserClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";

// Browser client — used in Client Components for realtime + storage signed URLs.
// Publishable key is safe to expose; RLS + backend authorization is the real guard.
export function createSupabaseBrowserClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
  );
}

// Admin client — server-only, uses secret key. Bypasses RLS.
// Never import into a Client Component or a file with "use client".
export function createSupabaseAdminClient() {
  if (typeof window !== "undefined") {
    throw new Error("Supabase admin client must not be used in the browser");
  }
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!,
    { auth: { persistSession: false } },
  );
}
