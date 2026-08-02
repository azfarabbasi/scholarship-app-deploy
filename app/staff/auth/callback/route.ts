import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { sanitizeRedirectPath } from "@/lib/security/redirect";

/**
 * Handles Supabase's PKCE/magic-link/OAuth redirect (`?code=...`). Password
 * sign-in (the primary staff login path) never hits this route, but Supabase
 * Auth always needs a callback endpoint configured for the other grant
 * types, and an administrator may choose to invite staff via magic link.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = sanitizeRedirectPath(searchParams.get("next"), origin, "/staff", { requiredPrefix: "/staff" });

  if (code) {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/staff/login`);
}
