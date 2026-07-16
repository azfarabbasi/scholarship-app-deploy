import "server-only";
import { createClient } from "@supabase/supabase-js";
import { getServerEnv } from "@/lib/env";

/**
 * The Supabase Admin API client, backed by the secret service-role key. Only
 * ever constructed server-side (guarded by `server-only`); the secret key
 * must never reach a client bundle or a log line. Used exclusively by the
 * staff Team page's invite flow — never exposed as a general-purpose client.
 */
export function createSupabaseAdminClient() {
  const env = getServerEnv("staff invitations");
  if (!env.NEXT_PUBLIC_SUPABASE_URL) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL must be set.");
  }
  return createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SECRET_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
