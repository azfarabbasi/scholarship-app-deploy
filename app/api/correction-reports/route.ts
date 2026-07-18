import { NextResponse } from "next/server";
import { getDb, schema } from "@/lib/db/client";
import { EnvironmentConfigurationError } from "@/lib/env";
import { correctionReportInputSchema } from "@/lib/schemas/correction-report";
import { checkAndConsumeCookieQuota } from "@/lib/security/cookie-rate-limit";

export const dynamic = "force-dynamic";

/** Generous but real: this is an abuse deterrent for a free-text public form, not a strict resource cap. */
const DAILY_CORRECTION_REPORT_LIMIT = 20;
const CORRECTION_QUOTA_COOKIE_NAME = "st_correction_quota";

/**
 * The only path a guest can submit a correction report through — never
 * directly over PostgREST (see the RLS design note in
 * `src/lib/db/schema/common.ts`). This keeps Zod validation, length limits,
 * the honeypot check, and (Checkpoint 6) a per-browser daily rate limit as
 * the actual enforcement, not just client-side UX.
 */
export async function POST(request: Request) {
  const existingQuotaCookie = request.headers
    .get("cookie")
    ?.split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${CORRECTION_QUOTA_COOKIE_NAME}=`))
    ?.slice(CORRECTION_QUOTA_COOKIE_NAME.length + 1);

  const quota = checkAndConsumeCookieQuota("correction-report", existingQuotaCookie, DAILY_CORRECTION_REPORT_LIMIT);

  /** Every response carries the updated quota cookie, whatever the outcome — mirrors the AI guest quota's contract. */
  function respond(body: unknown, init?: ResponseInit): NextResponse {
    const response = NextResponse.json(body, init);
    response.cookies.set(CORRECTION_QUOTA_COOKIE_NAME, quota.nextCookieValue, {
      httpOnly: true,
      sameSite: "lax",
      secure: true,
      path: "/",
      maxAge: 60 * 60 * 24,
    });
    return response;
  }

  if (!quota.allowed) {
    return respond({ error: "rate-limited" }, { status: 429 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return respond({ error: "invalid-request" }, { status: 400 });
  }

  const result = correctionReportInputSchema.safeParse(body);
  if (!result.success) {
    return respond({ error: "validation-failed", issues: result.error.issues.map((i) => i.message) }, { status: 400 });
  }

  if (result.data.honeypot) {
    // Report success to the bot without writing anything.
    return respond({ status: "submitted" });
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
      return respond({ error: "service-unavailable" }, { status: 503 });
    }
    console.error("ScholarTrack: failed to save a correction report.", error);
    return respond({ error: "internal-error" }, { status: 500 });
  }

  // No internal queue ID is ever returned to the reporter.
  return respond({ status: "submitted" });
}
