import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getPublicEnv } from "@/lib/env";

const PUBLIC_STAFF_PATHS = ["/staff/login", "/staff/auth/callback", "/staff/unauthorized"];
const PUBLIC_AUTH_PATHS = ["/auth/login", "/auth/signup", "/auth/callback"];

/**
 * Public pages that render session-dependent content (a signed-in student's
 * email, profile id, etc.) via a Server Component, but are NOT under
 * `/account` and so are otherwise eligible for the service worker's
 * app-shell cache. Marking the response `Cache-Control: no-store` when a
 * user is signed in stops the service worker from ever writing that
 * specific person's rendered page into the shared cache — see the matching
 * check in `public/sw.js`'s `networkFirstNavigation`. Guest (signed-out)
 * responses are unaffected and remain cacheable for offline use.
 */
const SESSION_AWARE_PUBLIC_PATHS = ["/workspace", "/privacy"];

/** Only ever redirect to a same-origin path under `prefix` — never an open redirect. */
function sanitizeNextPath(path: string | null, prefix: string, fallback: string): string {
  if (!path || !path.startsWith(prefix) || path.startsWith("//") || path.includes("://")) {
    return fallback;
  }
  return path;
}

/**
 * Refreshes the Supabase SSR session cookie on every request (the documented
 * pattern for `@supabase/ssr`) and gates `/staff/**` and `/account/**` at the
 * edge. This is a UX convenience only — every Server Action/Route Handler on
 * both sides independently re-verifies the session server-side (see
 * `src/lib/auth/session.ts` and `src/lib/auth/student-session.ts`); nothing
 * here is trusted as the sole authorization check. Staff and student
 * sessions are the same Supabase Auth user table but are otherwise
 * completely independent gates — being signed in for one never implies
 * access to the other.
 */
export async function updateSupabaseSession(request: NextRequest): Promise<NextResponse> {
  let response = NextResponse.next({ request });

  const env = getPublicEnv();
  if (!env.NEXT_PUBLIC_SUPABASE_URL || !env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) {
    return response;
  }

  const supabase = createServerClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;
  const isPublicStaffPath = PUBLIC_STAFF_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`));
  const isPublicAuthPath = PUBLIC_AUTH_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`));

  if (pathname.startsWith("/api/staff") && !user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  if (pathname.startsWith("/staff") && !isPublicStaffPath && !user) {
    const loginUrl = new URL("/staff/login", request.url);
    loginUrl.searchParams.set("next", sanitizeNextPath(pathname, "/staff", "/staff"));
    return NextResponse.redirect(loginUrl);
  }

  if (pathname.startsWith("/api/account") && !user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  if (pathname.startsWith("/account") && !user) {
    const loginUrl = new URL("/auth/login", request.url);
    loginUrl.searchParams.set("next", sanitizeNextPath(pathname, "/account", "/account"));
    return NextResponse.redirect(loginUrl);
  }

  if (pathname.startsWith("/auth") && !isPublicAuthPath && pathname !== "/auth/logout" && !user) {
    return NextResponse.redirect(new URL("/auth/login", request.url));
  }

  if (user && SESSION_AWARE_PUBLIC_PATHS.includes(pathname)) {
    response.headers.set("Cache-Control", "no-store, private");
  }

  return response;
}
