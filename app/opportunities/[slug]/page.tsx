import type { Metadata } from "next";
import { Container } from "@/components/layout/Container";
import { CustomOpportunityDetailClient } from "@/components/opportunities/CustomOpportunityDetailClient";
import { OpportunityDetailBody } from "@/components/opportunities/OpportunityDetailBody";
import { getAllBuiltInOpportunities, getBuiltInOpportunityBySlug } from "@/lib/catalogue/repository";

interface PageParams {
  params: Promise<{ slug: string }>;
}

export function generateStaticParams() {
  return getAllBuiltInOpportunities().map((opportunity) => ({ slug: opportunity.slug }));
}

export async function generateMetadata({ params }: PageParams): Promise<Metadata> {
  const { slug } = await params;
  const opportunity = getBuiltInOpportunityBySlug(slug);

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
  const opportunity = getBuiltInOpportunityBySlug(slug);

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
