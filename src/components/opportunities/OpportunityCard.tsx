"use client";

import { ArrowRight, Bookmark, BookmarkCheck, ExternalLink, MapPin, Scale } from "lucide-react";
import Link from "next/link";
import { Card, CardBody, CardFooter } from "@/components/ui/Card";
import { Checkbox } from "@/components/ui/Field";
import type { EnrichedOpportunity } from "@/lib/catalogue/types";
import { checklistProgress, toggleShortlisted } from "@/lib/storage/workspace";
import { useComparisonSelection } from "@/hooks/useComparisonSelection";
import { evaluateMatch } from "@/lib/matching/engine";
import type { EligibilityAnswers } from "@/lib/schemas/eligibility-answers";
import type { PlanningPreferences } from "@/lib/storage/types";
import { MatchBadge } from "@/components/matching/MatchBadge";
import { DeadlineBadge, OriginBadge, StageBadge, VerificationBadge } from "./badges";

export interface OpportunityCardProps {
  item: EnrichedOpportunity;
  matchContext?: { answers: EligibilityAnswers; planning: PlanningPreferences };
}

/**
 * Accent stripe along the card's top edge, colour-matched to the deadline
 * engine's own `colorState`. It lets a grid be triaged by glance — urgent
 * cards read as a row of amber/red edges — without adding another line of text
 * to each tile. Purely reinforcing: the DeadlineBadge below still states the
 * same status in words, so nothing here is conveyed by colour alone.
 */
const ACCENT_BY_STATE: Record<string, string> = {
  green: "bg-success",
  amber: "bg-warning",
  red: "bg-danger",
  blue: "bg-info",
  grey: "bg-border",
  neutral: "bg-border",
};

export function OpportunityCard({ item, matchContext }: OpportunityCardProps) {
  const { opportunity, evaluation, workspace } = item;
  const progress = workspace ? checklistProgress(workspace.checklist) : null;
  const shortlisted = workspace?.shortlisted ?? false;
  const primaryLocation = opportunity.countries[0] ?? opportunity.regions[0] ?? null;
  const extraLocations = opportunity.countries.length + opportunity.regions.length - (primaryLocation ? 1 : 0);
  const comparison = useComparisonSelection();
  const isComparing = comparison.ids.includes(opportunity.id);
  const match =
    matchContext && opportunity.kind === "built-in"
      ? evaluateMatch(opportunity, matchContext.answers, matchContext.planning, evaluation)
      : null;

  const countdown = evaluation.countdown;
  const countdownText =
    countdown.allowed && countdown.days !== null
      ? countdown.state === "days-remaining"
        ? `${countdown.days} day${countdown.days === 1 ? "" : "s"} left`
        : countdown.state === "deadline-today"
          ? "Closes today"
          : countdown.state === "days-since-deadline"
            ? `Closed ${countdown.days} day${countdown.days === 1 ? "" : "s"} ago`
            : null
      : null;

  // Note: no `.reveal` here on purpose. Scroll-reveal fades each element in, and
  // on a 52-card grid that means dozens of cards sitting at partial opacity while
  // you scroll — which reads as noise and, more importantly, drops the footer
  // links below the AA contrast floor mid-fade (axe measured the blended result
  // at 3.3–4.4:1). Reveal is for a handful of page sections, not every row of a
  // long list.
  return (
    <Card
      className="group relative flex h-full flex-col overflow-hidden"
      interactive
      data-testid="opportunity-card"
      data-opportunity-slug={opportunity.slug}
    >
      <span
        aria-hidden="true"
        className={`absolute inset-x-0 top-0 h-1 ${ACCENT_BY_STATE[evaluation.colorState] ?? "bg-border"}`}
      />

      <CardBody className="flex flex-1 flex-col gap-3 pt-5">
        <div className="flex items-start justify-between gap-2">
          <div className="flex min-w-0 flex-wrap items-center gap-1.5">
            {primaryLocation ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-brand-tint px-2.5 py-1 text-xs font-medium text-brand">
                <MapPin className="h-3 w-3 shrink-0" aria-hidden="true" />
                {primaryLocation}
                {extraLocations > 0 ? <span className="text-brand/70">+{extraLocations}</span> : null}
              </span>
            ) : null}
            {opportunity.studyLevels.length > 0 ? (
              <span className="rounded-full bg-surface-muted px-2.5 py-1 text-xs text-foreground-muted">
                {opportunity.studyLevels.join(" · ")}
              </span>
            ) : null}
          </div>

          <button
            type="button"
            aria-pressed={shortlisted}
            aria-label={
              shortlisted ? `Remove ${opportunity.title} from shortlist` : `Add ${opportunity.title} to shortlist`
            }
            onClick={() => void toggleShortlisted(opportunity.id)}
            className="shrink-0 rounded-md p-1.5 text-foreground-subtle transition-transform hover:scale-110 hover:bg-surface-muted hover:text-brand motion-reduce:hover:scale-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus-ring)]"
          >
            {shortlisted ? (
              <BookmarkCheck className="h-5 w-5 text-brand" aria-hidden="true" />
            ) : (
              <Bookmark className="h-5 w-5" aria-hidden="true" />
            )}
          </button>
        </div>

        <h3 className="text-lg font-semibold leading-snug tracking-tight text-foreground">
          <Link
            href={`/opportunities/${opportunity.slug}`}
            className="rounded transition-colors group-hover:text-brand focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus-ring)]"
          >
            {/* Stretches the link over the whole card so the entire tile is one
                hit target; the interactive controls below carry `relative` to
                stay clickable above it. */}
            <span className="absolute inset-0" aria-hidden="true" />
            {opportunity.title}
          </Link>
        </h3>

        <p className="line-clamp-2 text-sm leading-relaxed text-foreground-muted">{opportunity.benefitSummary}</p>

        {/* Deadline is the decision-critical fact, so it gets its own panel and
            the largest non-title type on the card.

            Stacked, not side-by-side: the status labels are full sentences
            ("Deadline passed for this cycle") and Badge is deliberately
            `whitespace-nowrap`, so pairing them on one row overflowed the card
            and squeezed the countdown into a three-line column. Each element
            now owns its width. */}
        <div className="mt-auto flex flex-col items-start gap-1.5 rounded-lg border border-border bg-surface-muted p-3">
          <DeadlineBadge evaluation={evaluation} wrap className="max-w-full" />
          <span className="text-sm font-semibold text-foreground">{countdownText ?? "No fixed date"}</span>
          <p className="line-clamp-1 w-full text-xs text-foreground-muted" title={opportunity.deadlineRawText}>
            {opportunity.deadlineRawText}
          </p>
        </div>

        {progress && progress.total > 0 ? (
          <div>
            <div className="flex items-center justify-between text-xs text-foreground-muted">
              <span>
                Documents {progress.done}/{progress.total}
              </span>
              <span>{Math.round((progress.done / progress.total) * 100)}%</span>
            </div>
            <div
              className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-surface-muted"
              role="progressbar"
              aria-valuenow={progress.done}
              aria-valuemin={0}
              aria-valuemax={progress.total}
              aria-label={`Document checklist: ${progress.done} of ${progress.total} complete`}
            >
              <span
                className="block h-full rounded-full bg-brand transition-[width] duration-500"
                style={{ width: `${(progress.done / progress.total) * 100}%` }}
              />
            </div>
          </div>
        ) : null}

        <div className="flex flex-wrap items-center gap-1.5">
          <VerificationBadge kind={opportunity.kind} status={opportunity.verification.status} />
          <OriginBadge kind={opportunity.kind} />
          {workspace && workspace.stage !== "not-started" ? <StageBadge stage={workspace.stage} /> : null}
          {match ? <MatchBadge label={match.label} /> : null}
        </div>
      </CardBody>

      {/* Solid `bg-surface-muted`, never a translucent tint. An alpha fill
          composites against whatever sits behind the card, producing a colour
          no palette pair was validated against — axe measured this footer's
          links at 3.47–4.44:1 when it was `bg-surface-muted/40`. Solid keeps it
          on the checked pairs: brand 4.79:1 light / 8.50:1 dark, and
          foreground-muted 6.93:1 / 7.77:1. (foreground-subtle is only 4.47:1 on
          this surface, so it must not be used for text here.) */}
      <CardFooter className="relative flex flex-wrap items-center justify-between gap-2 bg-surface-muted">
        <div className="flex items-center gap-3">
          <Checkbox
            id={`compare-${opportunity.id}`}
            label={
              <span className="inline-flex items-center gap-1 text-xs">
                <Scale className="h-3.5 w-3.5" aria-hidden="true" /> Compare
              </span>
            }
            checked={isComparing}
            disabled={!isComparing && comparison.isFull}
            onChange={() => comparison.toggle(opportunity.id)}
          />
          {opportunity.officialUrl ? (
            <a
              href={opportunity.officialUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 rounded text-xs text-foreground-muted transition-colors hover:text-brand focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus-ring)]"
            >
              <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
              Official site
              <span className="sr-only">(opens in a new tab)</span>
            </a>
          ) : null}
        </div>

        <Link
          href={`/opportunities/${opportunity.slug}`}
          className="inline-flex items-center gap-1 rounded text-sm font-semibold text-brand transition-transform group-hover:translate-x-0.5 motion-reduce:group-hover:translate-x-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus-ring)]"
        >
          Open
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Link>
      </CardFooter>
    </Card>
  );
}
