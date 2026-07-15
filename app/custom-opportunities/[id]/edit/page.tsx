import type { Metadata } from "next";
import { Container } from "@/components/layout/Container";
import { EditCustomOpportunityClient } from "@/components/custom-opportunities/EditCustomOpportunityClient";

export const metadata: Metadata = {
  title: "Edit custom opportunity",
  robots: { index: false },
};

export default async function EditCustomOpportunityPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  return (
    <Container className="py-8 sm:py-10">
      <h1 className="text-2xl font-semibold text-foreground sm:text-3xl">Edit custom opportunity</h1>
      <p className="mt-2 max-w-2xl text-sm text-foreground-muted">
        Changes are saved locally on this device. Your existing tracking state (shortlist, stage, notes, checklist)
        is preserved.
      </p>
      <div className="mt-6 max-w-2xl">
        <EditCustomOpportunityClient id={id} />
      </div>
    </Container>
  );
}
