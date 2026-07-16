import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getPublicEnv } from "@/lib/env";

const PUBLIC_STAFF_PATHS = ["/staff/login", "/staff/auth/callback", "/staff/unauthorized"];

/** Only ever redirect to a same-origin, `/staff`-scoped path — never an open redirect. */
function sanitizeNextPath(path: string | null): string {
  if (!path || !path.startsWith("/staff") || path.startsWith("//") || path.includes("://")) {
    return "/staff";
  }
  return path;
}

/**
 * Refreshes the Supabase SSR session cookie on every request (the documented
 * pattern for `@supabase/ssr`) and gates `/staff/**` at the edge. This is a
 * UX convenience only — every staff Server Action/Route Handler independently
 * re-verifies the session and role server-side (see `src/lib/auth/session.ts`);
 * nothing here is trusted as the sole authorization check.
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

  if (pathname.startsWith("/api/staff") && !user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  if (pathname.startsWith("/staff") && !isPublicStaffPath && !user) {
    const loginUrl = new URL("/staff/login", request.url);
    loginUrl.searchParams.set("next", sanitizeNextPath(pathname));
    return NextResponse.redirect(loginUrl);
  }

  return response;
}
