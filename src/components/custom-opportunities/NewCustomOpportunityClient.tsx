"use client";

import { useBuiltInOpportunities } from "@/hooks/useBuiltInOpportunities";
import { createCustomOpportunity } from "@/lib/storage/custom-opportunities";
import { CustomOpportunityForm } from "./CustomOpportunityForm";

export function NewCustomOpportunityClient() {
  const { items: builtInOpportunities } = useBuiltInOpportunities();

  return (
    <CustomOpportunityForm
      submitLabel="Create opportunity"
      onSubmit={async (input) => {
        const record = await createCustomOpportunity(
          input,
          builtInOpportunities.map((o) => o.slug),
        );
        return { slug: record.slug };
      }}
    />
  );
}
