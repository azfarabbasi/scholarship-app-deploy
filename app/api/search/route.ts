import { NextResponse, type NextRequest } from "next/server";
import { EnvironmentConfigurationError } from "@/lib/env";
import { parseSearchQuery } from "@/lib/search/query";
import { searchOpportunities } from "@/lib/search/service";

/**
 * Public search over the published catalogue only — see
 * `src/lib/search/service.ts` for why this can never surface a draft,
 * archived, or merged record. Always dynamic (a newly published/archived
 * record must be reflected immediately), and never cached by a shared/CDN
 * cache (`public/sw.js` treats this like `/api/opportunities`: safe for the
 * offline stale-while-revalidate cache, but query params make it a poor
 * candidate for that in practice since every distinct query is a distinct
 * cache key — no private data is ever in the response either way).
 */
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const query = parseSearchQuery(request.nextUrl.searchParams);
    const result = await searchOpportunities(query);
    return NextResponse.json(result, {
      headers: { "Cache-Control": "public, max-age=0, must-revalidate" },
    });
  } catch (error) {
    if (error instanceof EnvironmentConfigurationError) {
      return NextResponse.json(
        { error: "service-unavailable", message: "Search is temporarily unavailable." },
        { status: 503 },
      );
    }
    console.error("ScholarTrack: /api/search failed.", error);
    return NextResponse.json({ error: "internal-error", message: "Search is temporarily unavailable." }, { status: 500 });
  }
}
