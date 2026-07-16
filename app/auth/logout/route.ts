import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Signs the student out and redirects to the public home page. Clears only
 * the Supabase auth session cookie — guest/local IndexedDB data is
 * untouched and remains usable immediately after sign-out (see
 * `docs/checkpoint-3/privacy-and-data-controls.md`).
 */
export async function POST(request: NextRequest) {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  return NextResponse.redirect(new URL("/", request.url));
}
