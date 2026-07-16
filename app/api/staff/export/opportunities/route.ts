import { NextResponse } from "next/server";
import { getStaffSession } from "@/lib/auth/session";
import { getPublishedOpportunities } from "@/lib/catalogue/db-repository";
import { buildCsv } from "@/lib/csv/export";

export const dynamic = "force-dynamic";

const EXPORT_HEADERS = ["title", "slug", "opportunityType", "providerName", "countries", "studyLevels", "officialUrl", "verificationStatus"] as const;

/** Published, public data only — never staff notes or private review records. */
export async function GET() {
  const session = await getStaffSession();
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const opportunities = await getPublishedOpportunities();
  const rows = opportunities.map((o) => [
    o.title,
    o.slug,
    o.opportunityType,
    o.providerName ?? "",
    o.countries.join(";"),
    o.studyLevels.join(";"),
    o.officialUrl ?? "",
    o.verification.status,
  ]);

  return new NextResponse(buildCsv(EXPORT_HEADERS, rows), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="scholartrack-published-opportunities.csv"',
      "Cache-Control": "no-store",
    },
  });
}
