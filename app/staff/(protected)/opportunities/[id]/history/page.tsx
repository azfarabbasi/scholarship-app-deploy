import { notFound } from "next/navigation";
import { desc, eq } from "drizzle-orm";
import { getDb, schema } from "@/lib/db/client";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function OpportunityHistoryPage({ params }: PageProps) {
  const { id } = await params;
  const db = getDb();

  const [opportunity] = await db.select({ title: schema.opportunities.title }).from(schema.opportunities).where(eq(schema.opportunities.id, id));
  if (!opportunity) {
    notFound();
  }

  const versions = await db
    .select({
      versionNumber: schema.opportunityVersions.versionNumber,
      changeReason: schema.opportunityVersions.changeReason,
      reviewOutcome: schema.opportunityVersions.reviewOutcome,
      publicationOutcome: schema.opportunityVersions.publicationOutcome,
      createdAt: schema.opportunityVersions.createdAt,
      authorStaffProfileId: schema.opportunityVersions.authorStaffProfileId,
    })
    .from(schema.opportunityVersions)
    .where(eq(schema.opportunityVersions.opportunityId, id))
    .orderBy(desc(schema.opportunityVersions.versionNumber));

  return (
    <div className="flex max-w-2xl flex-col gap-4">
      <h1 className="text-xl font-semibold text-foreground">Version history — {opportunity!.title}</h1>
      <ol className="flex flex-col gap-3">
        {versions.map((version) => (
          <li key={version.versionNumber} className="rounded-md border border-border p-3 text-sm">
            <p className="font-medium text-foreground">Version {version.versionNumber}</p>
            <p className="text-foreground-muted">{version.createdAt.toLocaleString()}</p>
            {version.changeReason ? <p className="mt-1">Reason: {version.changeReason}</p> : null}
            {version.reviewOutcome ? <p>Review outcome: {version.reviewOutcome}</p> : null}
            {version.publicationOutcome ? <p>Publication outcome: {version.publicationOutcome}</p> : null}
          </li>
        ))}
      </ol>
    </div>
  );
}
