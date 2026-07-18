"use client";

import { ArrowLeft, ExternalLink } from "lucide-react";
import Link from "next/link";
import { Alert } from "@/components/ui/Alert";
import { OpportunityAssistantPanel } from "@/components/assistant/OpportunityAssistantPanel";
import { GuestTrackingPanel } from "@/components/workspace/GuestTrackingPanel";
import { MatchReasonsPanel } from "@/components/matching/MatchReasonsPanel";
import { useDeadlineEvaluation } from "@/hooks/useDeadlineEvaluation";
import { useMatchData } from "@/hooks/useMatchData";
import { evaluateMatch } from "@/lib/matching/engine";
import type { CatalogueOpportunity } from "@/lib/catalogue/types";
import { DeadlineBadge, DeadlineCountdownText, OriginBadge, VerificationBadge } from "./badges";
import { ReportCorrectionDialog } from "./ReportCorrectionDialog";

const VERIFICATION_STATUS_LABELS: Record<CatalogueOpportunity["verification"]["status"], string> = {
  unverified: "Not yet verified by staff",
  partially_verified: "Partially verified by staff",
  verified: "Verified by staff",
  stale: "Verified previously — due for re-check",
};

export function OpportunityDetailBody({
  opportunity,
  studentProfileId = null,
  aiAvailable = false,
}: {
  opportunity: CatalogueOpportunity;
  studentProfileId?: string | null;
  aiAvailable?: boolean;
}) {
  const evaluation = useDeadlineEvaluation(opportunity.deadlineInput);
  const location = [...opportunity.countries, ...opportunity.regions].join(", ");
  const { answers, planning, loading: matchLoading } = useMatchData(studentProfileId);
  const match = !matchLoading && opportunity.kind === "built-in" && evaluation ? evaluateMatch(opportunity, answers, planning, evaluation) : null;

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

        {/*
          Deliberately its own section, separate from deadline status above:
          verification/source freshness must never be visually or
          semantically combined with deadline status (checkpoint-2-architecture.md,
          "public verification display").
        */}
        <section className="mt-6">
          <h2 className="text-base font-semibold text-foreground">Verification</h2>
          <dl className="mt-2 grid grid-cols-1 gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
            <div>
              <dt className="font-medium text-foreground-muted">Status</dt>
              <dd className="mt-0.5 text-foreground">{VERIFICATION_STATUS_LABELS[opportunity.verification.status]}</dd>
            </div>
            <div>
              <dt className="font-medium text-foreground-muted">Last checked</dt>
              <dd className="mt-0.5 text-foreground">
                {opportunity.verification.lastCheckedAt ? new Date(opportunity.verification.lastCheckedAt).toLocaleDateString() : "Not recorded"}
              </dd>
            </div>
            {opportunity.verification.officialSourceLabel ? (
              <div>
                <dt className="font-medium text-foreground-muted">Official source</dt>
                <dd className="mt-0.5 text-foreground">{opportunity.verification.officialSourceLabel}</dd>
              </div>
            ) : null}
            <div>
              <dt className="font-medium text-foreground-muted">Official required documents</dt>
              <dd className="mt-0.5 text-foreground">
                {opportunity.verification.documentCount > 0
                  ? `${opportunity.verification.documentCount} verified requirement(s) on file`
                  : "None recorded yet — see the preparation checklist below for general suggestions only"}
              </dd>
            </div>
            <div>
              <dt className="font-medium text-foreground-muted">Eligibility requirements</dt>
              <dd className="mt-0.5 text-foreground">
                {opportunity.verification.eligibilityRuleCount > 0
                  ? `${opportunity.verification.eligibilityRuleCount} sourced rule(s) on file`
                  : "Not yet structured — see the eligibility summary above"}
              </dd>
            </div>
          </dl>
        </section>

        {opportunity.kind === "built-in" ? (
          <section className="mt-6">
            <ReportCorrectionDialog opportunityId={opportunity.id} />
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
            <p className="mt-2 text-xs text-foreground-subtle">
              Always verify current deadlines, eligibility, and funding on the official site before applying.
            </p>
          </section>
        ) : null}
      </div>

      <div className="flex flex-col gap-6 lg:w-96 lg:shrink-0">
        {match ? <MatchReasonsPanel result={match} /> : null}
        <GuestTrackingPanel opportunityId={opportunity.id} title={opportunity.title} />
        {opportunity.kind === "built-in" && aiAvailable ? (
          <OpportunityAssistantPanel
            studentProfileId={studentProfileId}
            opportunitySlug={opportunity.slug}
            opportunityTitle={opportunity.title}
            match={match}
          />
        ) : null}
      </div>
    </div>
  );
}
