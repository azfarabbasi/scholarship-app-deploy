import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { EnvironmentConfigurationError, getPublicEnv } from "@/lib/env";

/**
 * Server-side Supabase client for Route Handlers and Server Actions, backed
 * by cookie-based SSR sessions (the current `@supabase/ssr` approach — not
 * the deprecated `@supabase/auth-helpers-nextjs` package). Reading a cookie
 * from a Server Component (rather than a Route Handler/Server Action) can't
 * set cookies, so `setAll` there is deliberately a no-op guarded by a
 * try/catch — middleware.ts is what actually refreshes the session cookie on
 * every request.
 */
export async function createSupabaseServerClient() {
  const env = getPublicEnv();

  if (!env.NEXT_PUBLIC_SUPABASE_URL || !env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) {
    throw new EnvironmentConfigurationError("staff authentication");
  }

  const cookieStore = await cookies();

  return createServerClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Called from a Server Component render; middleware.ts refreshes
          // the session cookie for the next request instead.
        }
      },
    },
  });
}
