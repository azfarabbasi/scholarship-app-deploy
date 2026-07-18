import { CalendarDays, ClipboardList, ShieldAlert, ShieldCheck, Sparkles } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { Container } from "@/components/layout/Container";
import { JsonLd } from "@/components/common/JsonLd";
import { CurrentDate } from "@/components/home/CurrentDate";
import { StatsGrid } from "@/components/home/StatsGrid";
import { CatalogueExplorer } from "@/components/opportunities/CatalogueExplorer";
import { getPublishedOpportunityCount } from "@/lib/catalogue/db-repository";
import { getAppBaseUrl, isDatabaseConfigured } from "@/lib/env";
import { buildMetadata, SITE_NAME } from "@/lib/seo/metadata";

export const metadata: Metadata = buildMetadata({
  title: "ScholarTrack — Verified scholarship & internship tracking",
  description:
    "Discover, track, and plan verified scholarship and internship opportunities. Your shortlist, notes, and checklists stay on your device.",
  path: "/",
});

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

export default async function HomePage() {
  const count = await getBuiltInCount();
  const baseUrl = getAppBaseUrl();
  return (
    <>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@graph": [
            {
              "@type": "Organization",
              name: SITE_NAME,
              url: baseUrl,
            },
            {
              "@type": "WebSite",
              name: SITE_NAME,
              url: baseUrl,
              potentialAction: {
                "@type": "SearchAction",
                target: `${baseUrl}/opportunities?q={search_term_string}`,
                "query-input": "required name=search_term_string",
              },
            },
          ],
        }}
      />
      <section className="border-b border-border bg-surface">
        <Container className="flex flex-col gap-6 py-10 sm:py-14">
          <div className="max-w-2xl">
            <CurrentDate />
            <div className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-brand-tint px-3 py-1 text-xs font-medium text-brand">
              <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
              Verified sources, honest deadlines
            </div>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
              Track verified scholarships and internships with confidence.
            </h1>
            <p className="mt-4 text-base leading-relaxed text-foreground-muted">
              ScholarTrack helps you browse {count !== null ? `${count} published` : ""} scholarship and internship
              opportunities, understand which deadlines are reliable versus estimated, and organise your own
              applications — shortlist, stages, notes, checklists, and personal deadlines — entirely on your device
              as a guest.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Button size="lg" asChild>
                <Link href="/opportunities">Start exploring</Link>
              </Button>
              <Button variant="outline" size="lg" asChild>
                <Link href="/workspace">Track applications</Link>
              </Button>
              <Button variant="secondary" size="lg" asChild>
                <Link href="/assistant">
                  <Sparkles className="h-4 w-4" aria-hidden="true" />
                  Ask Scholarly
                </Link>
              </Button>
            </div>
          </div>

          <StatsGrid />
        </Container>
      </section>

      <Container className="flex flex-col gap-4 py-8">
        <Alert tone="warning" title="Verify before you rely on any deadline">
          Every opportunity here needs independent verification against its official source. ScholarTrack shows a
          precise date only when the source and verification gates allow it — otherwise you&rsquo;ll see
          &ldquo;Verify deadline&rdquo; or &ldquo;Deadline estimate only&rdquo;.
        </Alert>
        <Alert tone="info" title="Your data stays on this device">
          As a guest, your shortlist, notes, checklists, and custom opportunities are stored locally in your
          browser — nothing is sent to a ScholarTrack server. Back up your data any time from{" "}
          <Link href="/settings" className="underline">
            Settings
          </Link>
          .
        </Alert>
      </Container>

      <Container className="flex flex-col gap-4 pb-6 sm:flex-row">
        <Link
          href="/calendar"
          className="flex flex-1 items-center gap-3 rounded-lg border border-border bg-surface p-4 hover:bg-surface-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus-ring)]"
        >
          <CalendarDays className="h-8 w-8 text-brand" aria-hidden="true" />
          <div>
            <p className="font-medium text-foreground">Deadline calendar</p>
            <p className="text-sm text-foreground-muted">See upcoming and personal deadlines by month.</p>
          </div>
        </Link>
        <Link
          href="/workspace"
          className="flex flex-1 items-center gap-3 rounded-lg border border-border bg-surface p-4 hover:bg-surface-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus-ring)]"
        >
          <ClipboardList className="h-8 w-8 text-brand" aria-hidden="true" />
          <div>
            <p className="font-medium text-foreground">Your workspace</p>
            <p className="text-sm text-foreground-muted">Track stages, notes, and checklists for saved opportunities.</p>
          </div>
        </Link>
        <Link
          href="/privacy"
          className="flex flex-1 items-center gap-3 rounded-lg border border-border bg-surface p-4 hover:bg-surface-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus-ring)]"
        >
          <ShieldAlert className="h-8 w-8 text-brand" aria-hidden="true" />
          <div>
            <p className="font-medium text-foreground">Privacy boundaries</p>
            <p className="text-sm text-foreground-muted">Understand exactly what stays local and what doesn&rsquo;t.</p>
          </div>
        </Link>
      </Container>

      <Container className="pb-12">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-foreground">Explore the catalogue</h2>
          <Link href="/opportunities" className="text-sm font-medium text-brand hover:underline">
            View all
          </Link>
        </div>
        <Suspense fallback={<Skeleton className="h-96 w-full" />}>
          <CatalogueExplorer showFilters={false} />
        </Suspense>
      </Container>
    </>
  );
}
