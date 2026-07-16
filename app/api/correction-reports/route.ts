import { NextResponse } from "next/server";
import { getDb, schema } from "@/lib/db/client";
import { EnvironmentConfigurationError } from "@/lib/env";
import { correctionReportInputSchema } from "@/lib/schemas/correction-report";

export const dynamic = "force-dynamic";

/**
 * The only path a guest can submit a correction report through — never
 * directly over PostgREST (see the RLS design note in
 * `src/lib/db/schema/common.ts`). This keeps Zod validation, length limits,
 * and the honeypot check as the actual enforcement, not just client-side UX.
 */
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid-request" }, { status: 400 });
  }

  const result = correctionReportInputSchema.safeParse(body);
  if (!result.success) {
    return NextResponse.json({ error: "validation-failed", issues: result.error.issues.map((i) => i.message) }, { status: 400 });
  }

  if (result.data.honeypot) {
    // Report success to the bot without writing anything.
    return NextResponse.json({ status: "submitted" });
  }

  try {
    const db = getDb();
    await db.insert(schema.correctionReports).values({
      opportunityId: result.data.opportunityId,
      category: result.data.category,
      description: result.data.description,
      suggestedOfficialSourceUrl: result.data.suggestedOfficialSourceUrl ?? null,
      reporterContactEmail: result.data.reporterContactEmail ?? null,
      status: "submitted",
    });
  } catch (error) {
    if (error instanceof EnvironmentConfigurationError) {
      return NextResponse.json({ error: "service-unavailable" }, { status: 503 });
    }
    console.error("ScholarTrack: failed to save a correction report.", error);
    return NextResponse.json({ error: "internal-error" }, { status: 500 });
  }

  // No internal queue ID is ever returned to the reporter.
  return NextResponse.json({ status: "submitted" });
}
