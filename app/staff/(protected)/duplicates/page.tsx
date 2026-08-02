import { desc, eq } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { redirect } from "next/navigation";
import { canManageDuplicates } from "@/lib/auth/permissions";
import { getStaffSession } from "@/lib/auth/session";
import { getDb, schema } from "@/lib/db/client";
import { DuplicateCandidateActions, RunDetectionButton } from "@/components/staff/DuplicateCandidateActions";

export default async function StaffDuplicatesPage() {
  const session = await getStaffSession();
  if (!session || !canManageDuplicates(session.roles)) {
    redirect("/staff");
  }

  const db = getDb();
  const canonicalOpportunities = alias(schema.opportunities, "canonical_opportunities");
  const duplicateOpportunities = alias(schema.opportunities, "duplicate_opportunities");

  const rows = await db
    .select({
      id: schema.duplicateCandidates.id,
      detectionReason: schema.duplicateCandidates.detectionReason,
      confidenceScore: schema.duplicateCandidates.confidenceScore,
      status: schema.duplicateCandidates.status,
      canonicalTitle: canonicalOpportunities.title,
      duplicateTitle: duplicateOpportunities.title,
    })
    .from(schema.duplicateCandidates)
    .innerJoin(canonicalOpportunities, eq(schema.duplicateCandidates.canonicalOpportunityId, canonicalOpportunities.id))
    .innerJoin(duplicateOpportunities, eq(schema.duplicateCandidates.duplicateOpportunityId, duplicateOpportunities.id))
    .where(eq(schema.duplicateCandidates.status, "pending"))
    .orderBy(desc(schema.duplicateCandidates.createdAt));

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold text-foreground">Duplicate candidates</h1>
      <RunDetectionButton />
      <div className="flex flex-col gap-3">
        {rows.length === 0 ? (
          <p className="text-sm text-foreground-muted">No pending duplicate candidates.</p>
        ) : (
          rows.map((row) => (
            <div key={row.id} className="rounded-md border border-border p-3">
              <p className="text-sm font-medium text-foreground">
                &ldquo;{row.canonicalTitle}&rdquo; vs. &ldquo;{row.duplicateTitle}&rdquo;
              </p>
              <p className="text-xs text-foreground-muted">
                {row.detectionReason} · confidence {row.confidenceScore}
              </p>
              <div className="mt-2">
                <DuplicateCandidateActions candidateId={row.id} />
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
