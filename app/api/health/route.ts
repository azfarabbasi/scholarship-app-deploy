import { NextResponse } from "next/server";
import { isDatabaseConfigured } from "@/lib/env";
import { getPublishedOpportunityCount } from "@/lib/catalogue/db-repository";

// Depends on live database state, so this can never be statically generated.
export const dynamic = "force-dynamic";

export async function GET() {
  const databaseConfigured = isDatabaseConfigured();

  if (!databaseConfigured) {
    return NextResponse.json({ status: "degraded", checkpoint: 2, databaseConfigured, publishedOpportunityCount: null });
  }

  try {
    const publishedOpportunityCount = await getPublishedOpportunityCount();
    return NextResponse.json({ status: "ok", checkpoint: 2, databaseConfigured, publishedOpportunityCount });
  } catch {
    return NextResponse.json(
      { status: "degraded", checkpoint: 2, databaseConfigured, publishedOpportunityCount: null },
      { status: 503 },
    );
  }
}
