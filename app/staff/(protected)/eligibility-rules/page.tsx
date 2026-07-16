import Link from "next/link";
import { eq } from "drizzle-orm";
import { getDb, schema } from "@/lib/db/client";

export default async function StaffEligibilityRulesPage() {
  const db = getDb();
  const rows = await db
    .select({
      id: schema.eligibilityRules.id,
      fieldKey: schema.eligibilityRules.fieldKey,
      operator: schema.eligibilityRules.operator,
      explanation: schema.eligibilityRules.explanation,
      status: schema.eligibilityRules.status,
      opportunityId: schema.eligibilityRules.opportunityId,
      opportunityTitle: schema.opportunities.title,
    })
    .from(schema.eligibilityRules)
    .innerJoin(schema.opportunities, eq(schema.eligibilityRules.opportunityId, schema.opportunities.id));

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold text-foreground">Eligibility rules</h1>
      <p className="text-sm text-foreground-muted">
        Rules are authored per opportunity (open an opportunity and use its &ldquo;Eligibility rules&rdquo; section). This page is
        a cross-catalogue view for auditing coverage. Checkpoint 2 stores and manages these rules; evaluating them
        against a student profile is out of scope until a later checkpoint.
      </p>
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-left text-sm">
          <thead className="bg-surface-muted text-foreground-muted">
            <tr>
              <th className="px-3 py-2">Opportunity</th>
              <th className="px-3 py-2">Field</th>
              <th className="px-3 py-2">Operator</th>
              <th className="px-3 py-2">Explanation</th>
              <th className="px-3 py-2">Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-3 py-6 text-center text-foreground-muted">
                  No eligibility rules recorded yet.
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.id} className="border-t border-border">
                  <td className="px-3 py-2">
                    <Link href={`/staff/opportunities/${row.opportunityId}`} className="text-foreground hover:underline">
                      {row.opportunityTitle}
                    </Link>
                  </td>
                  <td className="px-3 py-2">{row.fieldKey}</td>
                  <td className="px-3 py-2">{row.operator}</td>
                  <td className="px-3 py-2 text-foreground-muted">{row.explanation}</td>
                  <td className="px-3 py-2">{row.status}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
