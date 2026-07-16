import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { OpportunityForm } from "@/components/staff/OpportunityForm";
import { updateOpportunityDraft } from "@/lib/db/actions/opportunities";
import { getDb, schema } from "@/lib/db/client";
import { getOpportunityTypeOptions, getProviderOptions } from "@/lib/db/reference-data";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function EditOpportunityPage({ params }: PageProps) {
  const { id } = await params;
  const db = getDb();
  const [opportunity] = await db.select().from(schema.opportunities).where(eq(schema.opportunities.id, id));
  if (!opportunity) {
    notFound();
  }

  const [opportunityTypes, providers] = await Promise.all([getOpportunityTypeOptions(), getProviderOptions()]);

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold text-foreground">Edit opportunity</h1>
      <OpportunityForm
        opportunityTypes={opportunityTypes}
        providers={providers}
        initial={{
          title: opportunity!.title,
          summary: opportunity!.summary,
          description: opportunity!.description,
          opportunityTypeId: opportunity!.opportunityTypeId,
          providerId: opportunity!.providerId,
          applicationUrl: opportunity!.applicationUrl,
          officialWebsiteUrl: opportunity!.officialWebsiteUrl,
        }}
        requireChangeReason
        submitLabel="Save changes"
        onSubmit={(input) =>
          updateOpportunityDraft(id, {
            ...input,
            changeReason: input.changeReason ?? "",
          })
        }
      />
    </div>
  );
}
