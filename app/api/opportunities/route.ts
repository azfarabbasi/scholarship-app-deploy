import { NextResponse } from "next/server";
import { EnvironmentConfigurationError } from "@/lib/env";
import { getPublishedOpportunities } from "@/lib/catalogue/db-repository";

/**
 * The only public source of built-in catalogue data for the client. Always
 * dynamic (publish/archive must take effect immediately, and the response
 * carries a fresh `syncedAt` so the client can show a truthful "last
 * synchronised" time when it later falls back to its offline cache).
 */
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const opportunities = await getPublishedOpportunities();
    return NextResponse.json(
      { syncedAt: new Date().toISOString(), opportunities },
      {
        headers: {
          // Public data, safe for the service worker's stale-while-revalidate
          // cache, but never for a shared/CDN cache to hold stale-forever.
          "Cache-Control": "public, max-age=0, must-revalidate",
        },
      },
    );
  } catch (error) {
    if (error instanceof EnvironmentConfigurationError) {
      return NextResponse.json(
        { error: "service-unavailable", message: "The opportunity catalogue is temporarily unavailable." },
        { status: 503 },
      );
    }
    console.error("ScholarTrack: /api/opportunities failed.", error);
    return NextResponse.json(
      { error: "internal-error", message: "The opportunity catalogue is temporarily unavailable." },
      { status: 500 },
    );
  }
}
