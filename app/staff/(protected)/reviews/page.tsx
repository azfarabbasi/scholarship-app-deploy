import Link from "next/link";
import { eq } from "drizzle-orm";
import { getStaffSession } from "@/lib/auth/session";
import { getDb, schema } from "@/lib/db/client";
import { AcceptAssignmentButton } from "@/components/staff/AcceptAssignmentButton";
import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { WorkflowStatusBadge, workflowStatusLabel } from "@/components/staff/WorkflowStatusBadge";

/** Mirrors `reviewAssignmentStatusEnum` in src/lib/db/schema/enums.ts. */
const ASSIGNMENT_TONES: Record<string, BadgeTone> = {
  queued: "grey",
  assigned: "amber",
  accepted: "blue",
  "in-review": "blue",
  blocked: "red",
  completed: "green",
  reassigned: "grey",
  cancelled: "grey",
  expired: "red",
};

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

  const openCount = rows.filter((row) => row.status !== "completed").length;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">My review assignments</h1>
        <p className="mt-1 text-sm text-foreground-muted">
          {rows.length === 0
            ? "Nothing is assigned to you right now."
            : `${openCount} open of ${rows.length} total. Accept an assignment to move it into your queue.`}
        </p>
      </div>

      <div className="overflow-x-auto rounded-lg border border-border bg-surface shadow-e1">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-border bg-surface-muted text-xs uppercase tracking-wide text-foreground-muted">
            <tr>
              <th scope="col" className="px-3 py-2.5 font-semibold">
                Opportunity
              </th>
              <th scope="col" className="px-3 py-2.5 font-semibold">
                Assignment status
              </th>
              <th scope="col" className="px-3 py-2.5 font-semibold">
                Opportunity status
              </th>
              <th scope="col" className="px-3 py-2.5 font-semibold">
                Due
              </th>
              <th scope="col" className="px-3 py-2.5">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-3 py-12 text-center">
                  <p className="font-medium text-foreground">No review assignments yet.</p>
                  <p className="mt-1 text-sm text-foreground-muted">
                    An editor with assignment rights will send work here when it&rsquo;s ready for review.
                  </p>
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.id} className="border-t border-border transition-colors hover:bg-surface-muted/50">
                  <td className="px-3 py-2.5">
                    <Link
                      href={`/staff/opportunities/${row.opportunityId}`}
                      className="rounded font-medium text-foreground hover:text-brand hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus-ring)]"
                    >
                      {row.opportunityTitle}
                    </Link>
                  </td>
                  <td className="px-3 py-2.5">
                    <Badge tone={ASSIGNMENT_TONES[row.status] ?? "neutral"}>{workflowStatusLabel(row.status)}</Badge>
                  </td>
                  <td className="px-3 py-2.5">
                    <WorkflowStatusBadge status={row.opportunityStatus} />
                  </td>
                  <td className="px-3 py-2.5 whitespace-nowrap text-foreground-muted">
                    {row.dueAt ? row.dueAt.toLocaleDateString() : "—"}
                  </td>
                  <td className="px-3 py-2.5">
                    {row.status === "assigned" ? <AcceptAssignmentButton assignmentId={row.id} /> : null}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
