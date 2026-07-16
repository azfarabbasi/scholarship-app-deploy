"use client";

import { createBrowserClient } from "@supabase/ssr";
import { getPublicEnv } from "@/lib/env";

/**
 * Browser-side Supabase client. Only ever reads the two `NEXT_PUBLIC_*`
 * values — the publishable key is meant to be public (Supabase's own naming),
 * and RLS is what keeps it safe. Used solely for the staff login form; every
 * authorization decision is still re-verified server-side (see
 * `src/lib/auth/session.ts`), never trusted from this client alone.
 */
export function createSupabaseBrowserClient() {
  const env = getPublicEnv();

  if (!env.NEXT_PUBLIC_SUPABASE_URL || !env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) {
    throw new Error(
      "Supabase is not configured for this deployment. An administrator must set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY.",
    );
  }

  return createBrowserClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);
}
