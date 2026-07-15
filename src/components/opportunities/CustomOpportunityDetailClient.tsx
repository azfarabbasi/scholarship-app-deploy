"use client";

import { SearchX } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/common/EmptyState";
import { useCustomOpportunities } from "@/hooks/useCustomOpportunities";
import { customOpportunityToCatalogueOpportunity } from "@/lib/catalogue/custom-adapter";
import { OpportunityDetailBody } from "./OpportunityDetailBody";

export function CustomOpportunityDetailClient({ slug }: { slug: string }) {
  const { records, loading } = useCustomOpportunities();

  if (loading) {
    return <Skeleton className="h-96 w-full" />;
  }

  const record = records.find((r) => r.slug === slug);

  if (!record) {
    return (
      <EmptyState
        icon={<SearchX className="h-6 w-6" />}
        title="Opportunity not found"
        description="This opportunity doesn't exist in the catalogue, or it's a custom opportunity that isn't saved on this device or browser."
        action={
          <Button variant="outline" size="sm" asChild>
            <Link href="/opportunities">Back to opportunities</Link>
          </Button>
        }
      />
    );
  }

  return <OpportunityDetailBody opportunity={customOpportunityToCatalogueOpportunity(record)} />;
}
