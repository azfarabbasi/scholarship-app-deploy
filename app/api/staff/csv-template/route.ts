import { NextResponse } from "next/server";
import { getStaffSession } from "@/lib/auth/session";
import { canRunImports } from "@/lib/auth/permissions";
import { buildOpportunityCsvTemplate } from "@/lib/csv/opportunity-import";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getStaffSession();
  if (!session || !canRunImports(session.roles)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  return new NextResponse(buildOpportunityCsvTemplate(), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="scholartrack-opportunity-import-template.csv"',
      "Cache-Control": "no-store",
    },
  });
}
