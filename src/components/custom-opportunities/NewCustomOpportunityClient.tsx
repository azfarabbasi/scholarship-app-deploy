"use client";

import { createCustomOpportunity } from "@/lib/storage/custom-opportunities";
import { CustomOpportunityForm } from "./CustomOpportunityForm";

export function NewCustomOpportunityClient() {
  return (
    <CustomOpportunityForm
      submitLabel="Create opportunity"
      onSubmit={async (input) => {
        const record = await createCustomOpportunity(input);
        return { slug: record.slug };
      }}
    />
  );
}
