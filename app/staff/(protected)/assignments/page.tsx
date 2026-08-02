import { and, eq, inArray, isNull, or } from "drizzle-orm";
import { redirect } from "next/navigation";
import { canAssignReviewers } from "@/lib/auth/permissions";
import { getStaffSession } from "@/lib/auth/session";
import { getDb, schema } from "@/lib/db/client";
import { AssignReviewerForm } from "@/components/staff/AssignReviewerForm";

export default async function StaffAssignmentsPage() {
  const session = await getStaffSession();
  if (!session || !canAssignReviewers(session.roles)) {
    redirect("/staff");
  }

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
      .where(
        and(
          isNull(schema.staffRoleAssignments.revokedAt),
          eq(schema.staffProfiles.status, "active"),
          session.isBootstrapAdmin
            ? or(
                inArray(schema.staffRoleAssignments.role, ["reviewer", "senior_reviewer"]),
                eq(schema.staffRoleAssignments.staffProfileId, session.staffProfileId),
              )
            : inArray(schema.staffRoleAssignments.role, ["reviewer", "senior_reviewer"]),
        ),
      ),
  ]);

  const assignedOpportunityIds = new Set(activeAssignments.map((a) => a.opportunityId));
  const unassigned = inReviewOpportunities.filter((o) => !assignedOpportunityIds.has(o.id));
  const reviewerProfiles = new Map<string, { id: string; displayName: string; roles: Set<string> }>();

  for (const row of staffRows) {
    const existing = reviewerProfiles.get(row.staffProfileId);
    if (existing) {
      existing.roles.add(row.role);
    } else {
      reviewerProfiles.set(row.staffProfileId, {
        id: row.staffProfileId,
        displayName: row.displayName,
        roles: new Set([row.role]),
      });
    }
  }

  const reviewers = Array.from(reviewerProfiles.values())
    .map((reviewer) => ({
      id: reviewer.id,
      label: `${reviewer.displayName} (${
        session.isBootstrapAdmin && reviewer.id === session.staffProfileId
          ? "bootstrap super admin"
          : Array.from(reviewer.roles).sort().join(", ")
      })`,
    }))
    .sort((a, b) => a.label.localeCompare(b.label));

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold text-foreground">Unassigned reviews</h1>
      <p className="text-sm text-foreground-muted">
        Opportunities in review with no active reviewer assignment. Authors are excluded from reviewing their own
        drafts, except for the explicitly configured bootstrap super admin used for audited application testing.
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
                reviewers={reviewers.filter(
                  (reviewer) =>
                    reviewer.id !== opportunity.createdByStaffProfileId ||
                    (session.isBootstrapAdmin && reviewer.id === session.staffProfileId),
                )}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
