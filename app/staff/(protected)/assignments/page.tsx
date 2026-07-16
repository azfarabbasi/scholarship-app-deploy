import { eq, inArray } from "drizzle-orm";
import { getDb, schema } from "@/lib/db/client";
import { AssignReviewerForm } from "@/components/staff/AssignReviewerForm";

export default async function StaffAssignmentsPage() {
  const db = getDb();

  const [inReviewOpportunities, activeAssignments, staffRows] = await Promise.all([
    db
      .select({ id: schema.opportunities.id, title: schema.opportunities.title, createdByStaffProfileId: schema.opportunities.createdByStaffProfileId })
      .from(schema.opportunities)
      .where(eq(schema.opportunities.status, "in_review")),
    db
      .select({ opportunityId: schema.reviewAssignments.opportunityId })
      .from(schema.reviewAssignments)
      .where(inArray(schema.reviewAssignments.status, ["queued", "assigned", "accepted", "in-review"])),
    db
      .select({
        staffProfileId: schema.staffRoleAssignments.staffProfileId,
        role: schema.staffRoleAssignments.role,
        displayName: schema.staffProfiles.displayName,
      })
      .from(schema.staffRoleAssignments)
      .innerJoin(schema.staffProfiles, eq(schema.staffProfiles.id, schema.staffRoleAssignments.staffProfileId))
      .where(inArray(schema.staffRoleAssignments.role, ["reviewer", "senior_reviewer"])),
  ]);

  const assignedOpportunityIds = new Set(activeAssignments.map((a) => a.opportunityId));
  const unassigned = inReviewOpportunities.filter((o) => !assignedOpportunityIds.has(o.id));
  const reviewers = staffRows.map((row) => ({ id: row.staffProfileId, label: `${row.displayName} (${row.role})` }));

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold text-foreground">Unassigned reviews</h1>
      <p className="text-sm text-foreground-muted">
        Opportunities in review with no active reviewer assignment. An author can never be assigned to review their
        own draft — the form below hides them automatically.
      </p>
      {unassigned.length === 0 ? (
        <p className="text-sm text-foreground-muted">Nothing needs a reviewer right now.</p>
      ) : (
        <div className="flex flex-col gap-4">
          {unassigned.map((opportunity) => (
            <div key={opportunity.id} className="rounded-md border border-border p-3">
              <p className="mb-2 font-medium text-foreground">{opportunity.title}</p>
              <AssignReviewerForm
                opportunityId={opportunity.id}
                reviewers={reviewers.filter((r) => r.id !== opportunity.createdByStaffProfileId)}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
