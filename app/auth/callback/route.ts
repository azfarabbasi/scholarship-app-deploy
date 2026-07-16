import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/** Only ever redirect to a same-origin, non-`/staff` path — never an open redirect. */
function sanitizeNextPath(path: string | null): string {
  if (!path || path.startsWith("/staff") || path.startsWith("//") || path.includes("://")) {
    return "/account";
  }
  return path;
}

/**
 * Handles Supabase's PKCE/magic-link/email-confirmation redirect
 * (`?code=...`) for student accounts — the counterpart to
 * `app/staff/auth/callback/route.ts`. Never redirects into `/staff`.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = sanitizeNextPath(searchParams.get("next"));

  if (code) {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/auth/login`);
}
