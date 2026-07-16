import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { getDb, schema } from "@/lib/db/client";
import { CorrectionActions } from "@/components/staff/CorrectionActions";

export default async function StaffCorrectionsPage() {
  const db = getDb();
  const rows = await db
    .select({
      id: schema.correctionReports.id,
      category: schema.correctionReports.category,
      description: schema.correctionReports.description,
      status: schema.correctionReports.status,
      createdAt: schema.correctionReports.createdAt,
      opportunityId: schema.correctionReports.opportunityId,
      opportunityTitle: schema.opportunities.title,
    })
    .from(schema.correctionReports)
    .innerJoin(schema.opportunities, eq(schema.correctionReports.opportunityId, schema.opportunities.id))
    .orderBy(desc(schema.correctionReports.createdAt));

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold text-foreground">Correction reports</h1>
      <div className="flex flex-col gap-3">
        {rows.length === 0 ? (
          <p className="text-sm text-foreground-muted">No correction reports yet.</p>
        ) : (
          rows.map((row) => (
            <div key={row.id} className="rounded-md border border-border p-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <Link href={`/staff/opportunities/${row.opportunityId}`} className="font-medium text-foreground hover:underline">
                    {row.opportunityTitle}
                  </Link>
                  <p className="text-xs text-foreground-muted">
                    {row.category} · {row.createdAt.toLocaleString()} · status: {row.status}
                  </p>
                  <p className="mt-1 text-sm text-foreground">{row.description}</p>
                </div>
                <CorrectionActions correctionReportId={row.id} status={row.status} />
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
