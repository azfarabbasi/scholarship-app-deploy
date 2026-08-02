import type { Metadata } from "next";
import { Suspense } from "react";
import { Container } from "@/components/layout/Container";
import { Skeleton } from "@/components/ui/Skeleton";
import { JsonLd } from "@/components/common/JsonLd";
import { CatalogueExplorer } from "@/components/opportunities/CatalogueExplorer";
import { isDatabaseConfigured } from "@/lib/env";
import { getPublishedOpportunityCount } from "@/lib/catalogue/db-repository";
import { getStudentSession } from "@/lib/auth/student-session";
import { buildBreadcrumbList, buildMetadata } from "@/lib/seo/metadata";

// The published-opportunity count is live database state (publish/archive
// changes it), so this page must never be served from a build-time snapshot.
export const dynamic = "force-dynamic";

async function getBuiltInCount(): Promise<number | null> {
  if (!isDatabaseConfigured()) {
    return null;
  }
  try {
    return await getPublishedOpportunityCount();
  } catch {
    return null;
  }
}

export async function generateMetadata(): Promise<Metadata> {
  const count = await getBuiltInCount();
  return buildMetadata({
    title: "Browse opportunities",
    description:
      count !== null
        ? `Search, filter, and sort ${count} verified scholarship and internship opportunities, plus any you add yourself.`
        : "Search, filter, and sort verified scholarship and internship opportunities, plus any you add yourself.",
    path: "/opportunities",
  });
}

export default async function OpportunitiesPage() {
  const [count, session] = await Promise.all([getBuiltInCount(), getStudentSession()]);

  return (
    <Container className="py-8 sm:py-10">
      <JsonLd
        data={buildBreadcrumbList([
          { name: "Home", path: "/" },
          { name: "Opportunities", path: "/opportunities" },
        ])}
      />
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-foreground sm:text-3xl">Opportunity catalogue</h1>
        <p className="mt-2 max-w-2xl text-sm text-foreground-muted">
          {count !== null ? `${count} published opportunities` : "Published opportunities"}{" "}
          plus any custom ones you&rsquo;ve added. Always confirm deadlines and eligibility on the official website
          before applying.
        </p>
      </div>
      <Suspense fallback={<Skeleton className="h-96 w-full" />}>
        <CatalogueExplorer studentProfileId={session?.studentProfileId ?? null} />
      </Suspense>
    </Container>
  );
}
