import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getPublicEnv, isAdsConfigured, isAnalyticsConfigured, isProductionEnvironment } from "@/lib/env";
import { buildContentSecurityPolicy } from "@/lib/security/csp";
import { sanitizeRedirectPath } from "@/lib/security/redirect";

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

/**
 * Checkpoint 6: paths with no public SEO value or that only ever show a
 * visitor their own private data — staff admin, student account pages, every
 * Supabase auth route (staff or student), the AI assistant's saved-history
 * and settings views, the personal workspace, and every non-HTML API route.
 * `X-Robots-Tag` is set here rather than per-page `metadata.robots` so a new
 * page added under one of these prefixes is noindexed automatically instead
 * of requiring every individual page to remember to opt in. The general
 * `/assistant` chat page and public tool pages (`/opportunities`,
 * `/eligibility`, `/notifications`, `/compare`, `/calendar`, `/settings`)
 * are deliberately NOT included — they have real, indexable content value
 * even though some render session-aware data for a signed-in visitor (a
 * crawler has no session cookie, so it only ever sees the generic version).
 */
const NOINDEX_PREFIXES = ["/staff", "/account", "/auth", "/api", "/assistant/history", "/assistant/settings", "/workspace"];

/**
 * Checkpoint 6: pure static content pages with zero session-dependent
 * rendering — no `getStudentSession()`/`getStaffSession()` call anywhere in
 * their tree, so the response is byte-identical for every visitor. Since
 * `app/layout.tsx` now reads the per-request CSP nonce via `headers()`
 * (required for the nonce-based Content-Security-Policy — see
 * `src/lib/security/csp.ts`), every route in this app is dynamically
 * rendered at the Next.js level; without an explicit override here these
 * pages would otherwise fall back to Next's default dynamic Cache-Control
 * (`private, no-store`), which is unnecessarily strict for content that
 * never varies by visitor. A real, public, revalidating cache header
 * recovers most of the practical CDN/browser caching benefit even though
 * build-time static HTML generation is no longer in play.
 */
const PUBLIC_STATIC_CONTENT_PREFIXES = [
  "/about",
  "/methodology",
  "/terms",
  "/disclaimer",
  "/contact",
  "/faq",
  "/status",
  "/security",
  "/accessibility",
  "/advertising-policy",
  "/data-sources",
  "/verification-policy",
];

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
  // Checkpoint 6: a fresh nonce every request, threaded through as a request
  // header so `app/layout.tsx` can read it (via `next/headers`) and pass it
  // to `next-themes`' blocking theme script — the one inline script this app
  // legitimately needs before hydration. See `src/lib/security/csp.ts`.
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const pathname = request.nextUrl.pathname;
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  // Read by app/layout.tsx to decide whether the floating Scholarly widget
  // can possibly appear on this page at all, so it can skip the "is AI
  // available" DB check entirely on the majority of routes (staff, auth,
  // legal/static content, account sub-pages) where the widget never renders
  // — see src/lib/assistant/scholarly-widget-pages.ts.
  requestHeaders.set("x-pathname", pathname);
  const requestInit = { headers: requestHeaders };

  const env = getPublicEnv();
  const csp = buildContentSecurityPolicy({
    nonce,
    supabaseUrl: env.NEXT_PUBLIC_SUPABASE_URL,
    analyticsEnabled: isAnalyticsConfigured(),
    adsEnabled: isAdsConfigured(),
    production: isProductionEnvironment(),
    // Next.js's dev server (Turbopack/webpack Fast Refresh) needs 'unsafe-eval'
    // in script-src — see the doc comment on CspOptions.development. Checked
    // directly against NODE_ENV (what `next dev` vs. `next build`/`next start`
    // actually sets), independent of this app's own APP_ENV/production flag,
    // so a `test`/`preview` APP_ENV running a real production build never
    // accidentally gets the relaxed dev policy.
    development: process.env.NODE_ENV === "development",
  });
  const shouldNoindex = NOINDEX_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));

  /**
   * Applied to every response this function returns, from every branch —
   * a plain per-response `.headers.set()` call at the top of the function
   * is not enough, because the Supabase cookie-refresh path below
   * (`setAll`) constructs a brand new `NextResponse` that would otherwise
   * silently lose these headers.
   */
  function withSecurityHeaders(res: NextResponse): NextResponse {
    res.headers.set("Content-Security-Policy", csp);
    if (isProductionEnvironment()) {
      // max-age=2 years, includeSubDomains — HSTS is production-only: forcing
      // HTTPS on a plain local/dev http://localhost origin would break it.
      res.headers.set("Strict-Transport-Security", "max-age=63072000; includeSubDomains");
    }
    if (shouldNoindex) {
      res.headers.set("X-Robots-Tag", "noindex, nofollow");
    }
    return res;
  }

  let response = withSecurityHeaders(NextResponse.next({ request: requestInit }));

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
        response = withSecurityHeaders(NextResponse.next({ request: requestInit }));
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isPublicStaffPath = PUBLIC_STAFF_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`));
  const isPublicAuthPath = PUBLIC_AUTH_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`));

  if (pathname.startsWith("/api/staff") && !user) {
    return withSecurityHeaders(NextResponse.json({ error: "unauthorized" }, { status: 401 }));
  }

  if (pathname.startsWith("/staff") && !isPublicStaffPath && !user) {
    const loginUrl = new URL("/staff/login", request.url);
    loginUrl.searchParams.set("next", sanitizeRedirectPath(pathname, request.nextUrl.origin, "/staff", { requiredPrefix: "/staff" }));
    return withSecurityHeaders(NextResponse.redirect(loginUrl));
  }

  if (pathname.startsWith("/api/account") && !user) {
    return withSecurityHeaders(NextResponse.json({ error: "unauthorized" }, { status: 401 }));
  }

  if (pathname.startsWith("/account") && !user) {
    const loginUrl = new URL("/auth/login", request.url);
    loginUrl.searchParams.set("next", sanitizeRedirectPath(pathname, request.nextUrl.origin, "/account", { requiredPrefix: "/account" }));
    return withSecurityHeaders(NextResponse.redirect(loginUrl));
  }

  if (pathname.startsWith("/auth") && !isPublicAuthPath && pathname !== "/auth/logout" && !user) {
    return withSecurityHeaders(NextResponse.redirect(new URL("/auth/login", request.url)));
  }

  const isAlwaysNoStorePath = ALWAYS_NO_STORE_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
  const isSessionAwarePublicPath = SESSION_AWARE_PUBLIC_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(prefix));
  const isPublicStaticContentPath = PUBLIC_STATIC_CONTENT_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));

  if (isPublicStaticContentPath) {
    response.headers.set("Cache-Control", "public, max-age=300, stale-while-revalidate=86400");
  } else if (isAlwaysNoStorePath) {
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
