import { getOpportunityTypeOptions, getProviderOptions } from "@/lib/db/reference-data";
import { createOpportunityDraft } from "@/lib/db/actions/opportunities";
import { OpportunityForm } from "@/components/staff/OpportunityForm";

export default async function NewOpportunityPage() {
  const [opportunityTypes, providers] = await Promise.all([getOpportunityTypeOptions(), getProviderOptions()]);

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold text-foreground">New opportunity draft</h1>
      <OpportunityForm
        opportunityTypes={opportunityTypes}
        providers={providers}
        submitLabel="Create draft"
        onSubmit={(input) => createOpportunityDraft(input)}
      />
    </div>
  );
}
