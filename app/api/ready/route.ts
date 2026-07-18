import { NextResponse } from "next/server";
import { getAiConfig } from "@/lib/ai/config";
import { isDatabaseConfigured } from "@/lib/env";
import { getPublishedOpportunityCount } from "@/lib/catalogue/db-repository";

export const dynamic = "force-dynamic";

/**
 * Readiness (as distinct from `/api/health`'s liveness check): can this
 * instance actually serve real traffic right now? Checks the database with
 * a real query (not just "is a connection string configured") and reports
 * the AI provider's configuration status — never its key, never a live call
 * to the provider itself (an unreachable third-party API should not flip
 * this app's own readiness to "not ready"; the assistant already degrades
 * to a clear unavailable state per-request when the provider fails).
 */
export async function GET() {
  const databaseConfigured = isDatabaseConfigured();
  const ai = getAiConfig();
  const aiSummary = { enabled: ai.enabled, provider: ai.enabled ? ai.provider : null, available: ai.isAvailable };

  if (!databaseConfigured) {
    return NextResponse.json({ status: "not-ready", database: "not-configured", ai: aiSummary }, { status: 503 });
  }

  try {
    await getPublishedOpportunityCount();
    return NextResponse.json({ status: "ready", database: "connected", ai: aiSummary });
  } catch {
    return NextResponse.json({ status: "not-ready", database: "unreachable", ai: aiSummary }, { status: 503 });
  }
}
