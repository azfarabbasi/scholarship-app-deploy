import type { Metadata } from "next";
import { Container } from "@/components/layout/Container";
import { CustomOpportunityDetailClient } from "@/components/opportunities/CustomOpportunityDetailClient";
import { OpportunityDetailBody } from "@/components/opportunities/OpportunityDetailBody";
import { getPublishedOpportunityBySlug } from "@/lib/catalogue/db-repository";
import { isDatabaseConfigured } from "@/lib/env";

interface PageParams {
  params: Promise<{ slug: string }>;
}

// Intentionally dynamic, not statically generated: publishing, archiving, or
// merging a database-backed opportunity must take effect immediately (see
// docs/checkpoint-2/checkpoint-2-architecture.md, "public data flow").
export const dynamic = "force-dynamic";

async function lookupPublishedOpportunity(slug: string) {
  if (!isDatabaseConfigured()) {
    return null;
  }
  try {
    return await getPublishedOpportunityBySlug(slug);
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: PageParams): Promise<Metadata> {
  const { slug } = await params;
  const opportunity = await lookupPublishedOpportunity(slug);

  if (!opportunity) {
    return { title: "Opportunity" };
  }

  return {
    title: opportunity.title,
    description: opportunity.benefitSummary.slice(0, 155),
    alternates: { canonical: `/opportunities/${opportunity.slug}` },
  };
}

export default async function OpportunityDetailPage({ params }: PageParams) {
  const { slug } = await params;
  const opportunity = await lookupPublishedOpportunity(slug);

  return (
    <Container className="py-8 sm:py-10">
      {opportunity ? (
        <OpportunityDetailBody opportunity={opportunity} />
      ) : (
        <CustomOpportunityDetailClient slug={slug} />
      )}
    </Container>
  );
}
