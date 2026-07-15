import type { Metadata } from "next";
import { Suspense } from "react";
import { Container } from "@/components/layout/Container";
import { Skeleton } from "@/components/ui/Skeleton";
import { CatalogueExplorer } from "@/components/opportunities/CatalogueExplorer";
import { EXPECTED_BUILT_IN_COUNT } from "@/lib/catalogue/repository";

export const metadata: Metadata = {
  title: "Browse opportunities",
  description: `Search, filter, and sort ${EXPECTED_BUILT_IN_COUNT} verified scholarship and internship opportunities, plus any you add yourself.`,
  alternates: { canonical: "/opportunities" },
};

export default function OpportunitiesPage() {
  return (
    <Container className="py-8 sm:py-10">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-foreground sm:text-3xl">Opportunity catalogue</h1>
        <p className="mt-2 max-w-2xl text-sm text-foreground-muted">
          {EXPECTED_BUILT_IN_COUNT} built-in opportunities plus any custom ones you&rsquo;ve added. Always confirm
          deadlines and eligibility on the official website before applying.
        </p>
      </div>
      <Suspense fallback={<Skeleton className="h-96 w-full" />}>
        <CatalogueExplorer />
      </Suspense>
    </Container>
  );
}
