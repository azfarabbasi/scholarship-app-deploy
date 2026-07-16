import type { NextRequest } from "next/server";
import { updateSupabaseSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  return updateSupabaseSession(request);
}

export const config = {
  matcher: [
    /*
     * Run on everything except static assets, images, and the service
     * worker/manifest — those must stay reachable offline without a Supabase
     * round trip.
     */
    "/((?!_next/static|_next/image|favicon.ico|sw.js|manifest.webmanifest|icon|apple-icon).*)",
  ],
};
