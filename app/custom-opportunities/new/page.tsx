import type { Metadata } from "next";
import { Container } from "@/components/layout/Container";
import { NewCustomOpportunityClient } from "@/components/custom-opportunities/NewCustomOpportunityClient";

export const metadata: Metadata = {
  title: "Add a custom opportunity",
  description: "Create a local, guest-only opportunity to track alongside the built-in catalogue.",
  alternates: { canonical: "/custom-opportunities/new" },
};

export default function NewCustomOpportunityPage() {
  return (
    <Container className="py-8 sm:py-10">
      <h1 className="text-2xl font-semibold text-foreground sm:text-3xl">Add a custom opportunity</h1>
      <p className="mt-2 max-w-2xl text-sm text-foreground-muted">
        Track something the catalogue doesn&rsquo;t have yet. This is saved locally on this device only, and is
        never labelled as officially verified.
      </p>
      <div className="mt-6 max-w-2xl">
        <NewCustomOpportunityClient />
      </div>
    </Container>
  );
}
