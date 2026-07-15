import { NextResponse } from "next/server";
import { EXPECTED_BUILT_IN_COUNT, getAllBuiltInOpportunities } from "@/lib/catalogue/repository";

export const dynamic = "force-static";

export function GET() {
  const builtInCount = getAllBuiltInOpportunities().length;

  return NextResponse.json({
    status: builtInCount === EXPECTED_BUILT_IN_COUNT ? "ok" : "degraded",
    checkpoint: 1,
    builtInOpportunityCount: builtInCount,
    expectedBuiltInOpportunityCount: EXPECTED_BUILT_IN_COUNT,
  });
}
