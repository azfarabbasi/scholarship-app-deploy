import type { Metadata } from "next";
import { Container } from "@/components/layout/Container";
import { JsonLd } from "@/components/common/JsonLd";
import { CustomOpportunityDetailClient } from "@/components/opportunities/CustomOpportunityDetailClient";
import { OpportunityDetailBody } from "@/components/opportunities/OpportunityDetailBody";
import { getPublishedOpportunityBySlug } from "@/lib/catalogue/db-repository";
import { evaluateDeadline } from "@/lib/deadlines/engine";
import { isDatabaseConfigured } from "@/lib/env";
import { getStudentSession } from "@/lib/auth/student-session";
import { isAiAvailableAction } from "@/lib/db/actions/student/ai-assistant";
import { buildBreadcrumbList, buildMetadata } from "@/lib/seo/metadata";
import { isHttpUrl } from "@/lib/security/url";

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
    return { title: "Opportunity", robots: { index: false, follow: false } };
  }

  return buildMetadata({
    title: opportunity.title,
    description: opportunity.benefitSummary.slice(0, 155),
    path: `/opportunities/${opportunity.slug}`,
    ogType: "article",
  });
}

export default async function OpportunityDetailPage({ params }: PageParams) {
  const { slug } = await params;
  const [opportunity, session, aiAvailable] = await Promise.all([
    lookupPublishedOpportunity(slug),
    getStudentSession(),
    isAiAvailableAction(),
  ]);

  return (
    <Container className="py-8 sm:py-10">
      {opportunity ? (
        <>
          <JsonLd
            data={buildBreadcrumbList([
              { name: "Home", path: "/" },
              { name: "Opportunities", path: "/opportunities" },
              { name: opportunity.title, path: `/opportunities/${opportunity.slug}` },
            ])}
          />
          <JsonLd data={buildOpportunityStructuredData(opportunity)} />
          <OpportunityDetailBody opportunity={opportunity} studentProfileId={session?.studentProfileId ?? null} aiAvailable={aiAvailable} />
        </>
      ) : (
        <CustomOpportunityDetailClient slug={slug} />
      )}
    </Container>
  );
}

/**
 * `EducationalOccupationalProgram` structured data — only ever built from
 * fields the public catalogue already displays and treats as fact (never a
 * new claim). `applicationDeadline` is included only when
 * `evaluateDeadline().countdown.allowed` is true — the exact same gate the
 * on-page countdown uses — so an estimated, rolling, or unverified deadline
 * is never asserted to a search engine as a firm date. See ADR-005 and
 * `docs/checkpoint-0/deadline-intelligence-spec.md`.
 */
function buildOpportunityStructuredData(opportunity: Awaited<ReturnType<typeof getPublishedOpportunityBySlug>>): object {
  if (!opportunity) return {};
  const evaluation = evaluateDeadline(opportunity.deadlineInput, new Date());
  const projectedDate = evaluation.countdown.allowed ? evaluation.selectedOccurrence?.projectedDate : null;

  return {
    "@context": "https://schema.org",
    "@type": "EducationalOccupationalProgram",
    name: opportunity.title,
    description: opportunity.benefitSummary,
    ...(opportunity.providerName ? { provider: { "@type": "Organization", name: opportunity.providerName } } : {}),
    // Staff-entered, not validated at capture time — never assert a
    // javascript:/data:/other non-http(s) scheme into structured data a
    // crawler or downstream consumer might treat as a real link.
    ...(opportunity.officialUrl && isHttpUrl(opportunity.officialUrl) ? { url: opportunity.officialUrl } : {}),
    ...(projectedDate ? { applicationDeadline: projectedDate } : {}),
  };
}
