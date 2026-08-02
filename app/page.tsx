import { ArrowRight, CalendarDays, ClipboardList, Lock, ShieldAlert, ShieldCheck, Sparkles } from "lucide-react";
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

const HERO_POINTS = [
  { icon: ShieldCheck, text: "Staff-verified sources" },
  { icon: CalendarDays, text: "Honest deadline states" },
  { icon: Lock, text: "Guest data stays local" },
] as const;

const QUICK_LINKS = [
  {
    href: "/calendar",
    icon: CalendarDays,
    title: "Deadline calendar",
    description: "See upcoming and personal deadlines by month.",
  },
  {
    href: "/workspace",
    icon: ClipboardList,
    title: "Your workspace",
    description: "Track stages, notes, and checklists for saved opportunities.",
  },
  {
    href: "/privacy",
    icon: ShieldAlert,
    title: "Privacy boundaries",
    description: "Understand exactly what stays local and what doesn’t.",
  },
] as const;

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
      <section className="hero-surface border-b border-border">
        <Container className="flex flex-col gap-10 py-12 sm:py-20">
          <div className="max-w-3xl animate-rise">
            <CurrentDate />
            <div className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-brand/20 bg-brand-tint px-3 py-1 text-xs font-medium text-brand">
              <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
              Verified sources, honest deadlines
            </div>
            <h1 className="mt-4 text-balance text-4xl font-semibold leading-[1.1] tracking-tight text-foreground sm:text-5xl lg:text-6xl">
              Track verified scholarships and internships{" "}
              <span className="relative text-brand">
                with confidence.
                <span
                  aria-hidden="true"
                  className="absolute -bottom-1 left-0 h-[3px] w-full rounded-full bg-brand/25"
                />
              </span>
            </h1>
            {/* One sentence, then the detail moves to icon chips below. The long
                paragraph that used to sit here repeated what the stat tiles and
                the trust chips already show. */}
            <p className="mt-5 max-w-xl text-base leading-relaxed text-foreground-muted sm:text-lg">
              {/* Trailing space lives inside the template, not as JSX text after the
                  expression — a wrapped JSX text node loses its leading space. */}
              Browse {count !== null ? `${count} verified ` : ""}opportunities, see which deadlines you can trust, and
              track every application in one place.
            </p>

            <ul className="mt-6 flex flex-wrap gap-x-5 gap-y-2">
              {HERO_POINTS.map(({ icon: Icon, text }) => (
                <li key={text} className="inline-flex items-center gap-2 text-sm text-foreground-muted">
                  <Icon className="h-4 w-4 shrink-0 text-brand" aria-hidden="true" />
                  {text}
                </li>
              ))}
            </ul>

            <div className="mt-8 flex flex-wrap gap-3">
              <Button size="lg" asChild>
                <Link href="/opportunities">
                  Start exploring
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Link>
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

      {/* Side by side rather than stacked: these two are standing context, not
          incidents, so a full-width wall of alerts above the fold overstated them. */}
      <Container className="reveal grid gap-4 py-8 lg:grid-cols-2">
        {/* Kept — this disclaimer is the product's core honesty claim — but cut to
            one line each. The full explanation lives on /verification-policy and
            /privacy, which these now link to. */}
        <Alert tone="warning" title="Always confirm on the official site">
          Deadlines show a precise date only when verified;{" "}
          <Link href="/verification-policy" className="underline">
            how we verify
          </Link>
          .
        </Alert>
        <Alert tone="info" title="Your data stays on this device">
          Guest shortlists and notes never leave your browser;{" "}
          <Link href="/settings" className="underline">
            back up any time
          </Link>
          .
        </Alert>
      </Container>

      <Container className="reveal grid gap-4 pb-8 sm:grid-cols-3">
        {QUICK_LINKS.map(({ href, icon: Icon, title, description }) => (
          <Link
            key={href}
            href={href}
            className="card-interactive group flex items-start gap-4 rounded-lg border border-border bg-surface p-5 shadow-e1 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus-ring)]"
          >
            <span
              aria-hidden="true"
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-brand-tint text-brand transition-transform duration-300 group-hover:scale-110 motion-reduce:group-hover:scale-100"
            >
              <Icon className="h-5 w-5" />
            </span>
            <span className="min-w-0">
              <span className="flex items-center gap-1.5 font-medium text-foreground">
                {title}
                <ArrowRight
                  className="h-3.5 w-3.5 shrink-0 text-brand opacity-0 transition-opacity group-hover:opacity-100"
                  aria-hidden="true"
                />
              </span>
              <span className="mt-1 block text-sm text-foreground-muted">{description}</span>
            </span>
          </Link>
        ))}
      </Container>

      <Container className="reveal pb-16">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-3 border-b border-border pb-4">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight text-foreground">Explore the catalogue</h2>
            <p className="mt-1 text-sm text-foreground-muted">
              A sample of what&rsquo;s published right now — filter the full set on the catalogue page.
            </p>
          </div>
          <Link
            href="/opportunities"
            className="inline-flex items-center gap-1 rounded text-sm font-medium text-brand hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus-ring)]"
          >
            View all
            <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
          </Link>
        </div>
        <Suspense fallback={<Skeleton className="h-96 w-full" />}>
          <CatalogueExplorer showFilters={false} />
        </Suspense>
      </Container>
    </>
  );
}
