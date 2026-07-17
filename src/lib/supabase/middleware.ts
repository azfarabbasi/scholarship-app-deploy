import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getPublicEnv } from "@/lib/env";

const PUBLIC_STAFF_PATHS = ["/staff/login", "/staff/auth/callback", "/staff/unauthorized"];
const PUBLIC_AUTH_PATHS = ["/auth/login", "/auth/signup", "/auth/callback"];

/**
 * Public pages that render session-dependent content (a signed-in student's
 * email, profile id, eligibility-based match labels, etc.) via a Server
 * Component, but are NOT under `/account` and so are otherwise eligible for
 * the service worker's app-shell cache. Marking the response
 * `Cache-Control: no-store` when a user is signed in stops the service
 * worker from ever writing that specific person's rendered page into the
 * shared cache — see the matching check in `public/sw.js`'s
 * `networkFirstNavigation`.
 *
 * All of these call `getStudentSession()`, which reads cookies — Next.js's
 * own default for a `force-dynamic` route that reads cookies is an
 * aggressive `Cache-Control: private, no-cache, no-store, must-revalidate`,
 * applied regardless of whether a session actually exists. Left alone, that
 * default silently defeats the service worker's offline caching for a guest
 * too (found via the e2e offline test: a fresh service-worker install could
 * no longer serve `/opportunities` offline after `getStudentSession()` was
 * added here for Checkpoint 4's match/saved-search features). So a GUEST
 * visit to one of these paths gets an explicit `no-cache` override instead
 * — safe to store for offline use, but always revalidated against the
 * network first when online — while a signed-in visit still gets the
 * stricter `no-store`.
 */
const SESSION_AWARE_PUBLIC_PREFIXES = [
  "/workspace",
  "/privacy",
  "/eligibility",
  "/notifications",
  "/compare",
  "/opportunities",
  "/opportunities/",
];

/**
 * Checkpoint 5: unlike the pages above, the AI assistant provides genuinely
 * zero useful functionality offline — every feature is a live Server Action
 * call to a configured provider, with no meaningful cached/local fallback.
 * Always `no-store`, for guests and signed-in visitors alike, so a stale
 * cached shell is never served in place of the honest `/offline` fallback
 * (found via the e2e offline test: giving `/assistant` the same guest
 * `no-cache` treatment as `/workspace`/`/opportunities` let the service
 * worker legitimately cache and replay its shell offline, which is correct
 * for those pages' real offline value but not for a page whose only feature
 * requires a live network call). `/workspace/assistant` is listed
 * separately because it would otherwise also match the broader `/workspace`
 * prefix above.
 */
const ALWAYS_NO_STORE_PREFIXES = ["/assistant", "/workspace/assistant"];

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

  const isAlwaysNoStorePath = ALWAYS_NO_STORE_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
  const isSessionAwarePublicPath = SESSION_AWARE_PUBLIC_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(prefix));

  if (isAlwaysNoStorePath) {
    response.headers.set("Cache-Control", "no-store, private");
  } else if (user && isSessionAwarePublicPath) {
    response.headers.set("Cache-Control", "no-store, private");
  } else if (pathname === "/" || isSessionAwarePublicPath) {
    // The homepage never renders session-dependent content at all, so it always gets the
    // cacheable override, independent of sign-in state.
    response.headers.set("Cache-Control", "no-cache");
  }

  return response;
}
