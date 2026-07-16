import Link from "next/link";
import { eq } from "drizzle-orm";
import { getStaffSession } from "@/lib/auth/session";
import { getDb, schema } from "@/lib/db/client";
import { AcceptAssignmentButton } from "@/components/staff/AcceptAssignmentButton";

export default async function StaffReviewsPage() {
  const session = await getStaffSession();
  if (!session) return null;

  const db = getDb();
  const rows = await db
    .select({
      id: schema.reviewAssignments.id,
      status: schema.reviewAssignments.status,
      dueAt: schema.reviewAssignments.dueAt,
      opportunityId: schema.reviewAssignments.opportunityId,
      opportunityTitle: schema.opportunities.title,
      opportunityStatus: schema.opportunities.status,
    })
    .from(schema.reviewAssignments)
    .innerJoin(schema.opportunities, eq(schema.reviewAssignments.opportunityId, schema.opportunities.id))
    .where(eq(schema.reviewAssignments.reviewerStaffProfileId, session.staffProfileId));

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold text-foreground">My review assignments</h1>
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-left text-sm">
          <thead className="bg-surface-muted text-foreground-muted">
            <tr>
              <th className="px-3 py-2">Opportunity</th>
              <th className="px-3 py-2">Assignment status</th>
              <th className="px-3 py-2">Opportunity status</th>
              <th className="px-3 py-2">Due</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-3 py-6 text-center text-foreground-muted">
                  No review assignments yet.
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.id} className="border-t border-border">
                  <td className="px-3 py-2">
                    <Link href={`/staff/opportunities/${row.opportunityId}`} className="font-medium text-foreground hover:underline">
                      {row.opportunityTitle}
                    </Link>
                  </td>
                  <td className="px-3 py-2">{row.status}</td>
                  <td className="px-3 py-2">{row.opportunityStatus}</td>
                  <td className="px-3 py-2 text-foreground-muted">{row.dueAt ? row.dueAt.toLocaleDateString() : "—"}</td>
                  <td className="px-3 py-2">{row.status === "assigned" ? <AcceptAssignmentButton assignmentId={row.id} /> : null}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
