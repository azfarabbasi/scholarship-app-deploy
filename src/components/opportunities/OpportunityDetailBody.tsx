"use client";

import { ArrowLeft, ExternalLink } from "lucide-react";
import Link from "next/link";
import { Alert } from "@/components/ui/Alert";
import { GuestTrackingPanel } from "@/components/workspace/GuestTrackingPanel";
import { useDeadlineEvaluation } from "@/hooks/useDeadlineEvaluation";
import type { CatalogueOpportunity } from "@/lib/catalogue/types";
import { DeadlineBadge, DeadlineCountdownText, OriginBadge, VerificationBadge } from "./badges";

export function OpportunityDetailBody({ opportunity }: { opportunity: CatalogueOpportunity }) {
  const evaluation = useDeadlineEvaluation(opportunity.deadlineInput);
  const location = [...opportunity.countries, ...opportunity.regions].join(", ");

  return (
    <div className="flex flex-col gap-8 lg:flex-row lg:items-start">
      <div className="min-w-0 flex-1">
        <Link
          href="/opportunities"
          className="mb-4 inline-flex items-center gap-1 text-sm font-medium text-brand hover:underline"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Back to opportunities
        </Link>

        <div className="flex flex-wrap gap-2">
          <OriginBadge kind={opportunity.kind} />
          <span className="rounded-full bg-surface-muted px-2.5 py-1 text-xs font-medium text-foreground-muted">
            {opportunity.opportunityType}
          </span>
        </div>

        <h1 className="mt-3 text-2xl font-semibold text-foreground sm:text-3xl">{opportunity.title}</h1>

        <dl className="mt-4 grid grid-cols-1 gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="font-medium text-foreground-muted">Country / region</dt>
            <dd className="mt-0.5 text-foreground">{location || "Not specified"}</dd>
          </div>
          <div>
            <dt className="font-medium text-foreground-muted">Study levels</dt>
            <dd className="mt-0.5 text-foreground">{opportunity.studyLevels.join(", ") || "Not specified"}</dd>
          </div>
          {opportunity.providerName ? (
            <div>
              <dt className="font-medium text-foreground-muted">Provider</dt>
              <dd className="mt-0.5 text-foreground">{opportunity.providerName}</dd>
            </div>
          ) : null}
        </dl>

        {evaluation?.verificationRequired ? (
          <Alert tone="warning" title="Verify this deadline" className="mt-6">
            {evaluation.statusText} Always confirm the current cycle and exact date on the official website before
            relying on it.
          </Alert>
        ) : null}

        <section className="mt-6">
          <h2 className="text-base font-semibold text-foreground">Deadline</h2>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {evaluation ? (
              <>
                <DeadlineBadge evaluation={evaluation} />
                <DeadlineCountdownText evaluation={evaluation} />
              </>
            ) : null}
          </div>
          <p className="mt-2 text-sm text-foreground-muted">
            Original wording: &ldquo;{opportunity.deadlineRawText}&rdquo;
          </p>
          <div className="mt-2">
            <VerificationBadge kind={opportunity.kind} verificationRequired={evaluation?.verificationRequired ?? true} />
          </div>
        </section>

        <section className="mt-6">
          <h2 className="text-base font-semibold text-foreground">Benefits</h2>
          <p className="mt-2 whitespace-pre-line text-sm text-foreground-muted">{opportunity.benefitSummary}</p>
        </section>

        <section className="mt-6">
          <h2 className="text-base font-semibold text-foreground">Eligibility</h2>
          <p className="mt-2 whitespace-pre-line text-sm text-foreground-muted">{opportunity.eligibilitySummary}</p>
        </section>

        {opportunity.verificationNotes ? (
          <section className="mt-6">
            <h2 className="text-base font-semibold text-foreground">Verification notes</h2>
            <p className="mt-2 whitespace-pre-line text-sm text-foreground-muted">{opportunity.verificationNotes}</p>
          </section>
        ) : null}

        {opportunity.officialUrl ? (
          <section className="mt-6">
            <a
              href={opportunity.officialUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-md border border-border bg-surface-muted px-4 py-2.5 text-sm font-medium text-foreground hover:bg-border focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus-ring)]"
            >
              Visit official website
              <ExternalLink className="h-4 w-4" aria-hidden="true" />
              <span className="sr-only">(opens in a new tab)</span>
            </a>
          </section>
        ) : null}
      </div>

      <div className="lg:w-96 lg:shrink-0">
        <GuestTrackingPanel opportunityId={opportunity.id} title={opportunity.title} />
      </div>
    </div>
  );
}
