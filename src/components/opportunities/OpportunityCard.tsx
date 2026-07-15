"use client";

import { Bookmark, BookmarkCheck, ExternalLink, MapPin } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardFooter } from "@/components/ui/Card";
import type { EnrichedOpportunity } from "@/lib/catalogue/types";
import { checklistProgress, toggleShortlisted } from "@/lib/storage/workspace";
import { DeadlineBadge, DeadlineCountdownText, OriginBadge, StageBadge, VerificationBadge } from "./badges";

export function OpportunityCard({ item }: { item: EnrichedOpportunity }) {
  const { opportunity, evaluation, workspace } = item;
  const progress = workspace ? checklistProgress(workspace.checklist) : null;
  const shortlisted = workspace?.shortlisted ?? false;
  const location = [...opportunity.countries, ...opportunity.regions].join(", ");

  return (
    <Card className="flex h-full flex-col" data-testid="opportunity-card" data-opportunity-slug={opportunity.slug}>
      <CardBody className="flex flex-1 flex-col gap-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex flex-wrap gap-1.5">
            <OriginBadge kind={opportunity.kind} />
            {workspace && workspace.stage !== "not-started" ? <StageBadge stage={workspace.stage} /> : null}
          </div>
          <button
            type="button"
            aria-pressed={shortlisted}
            aria-label={shortlisted ? `Remove ${opportunity.title} from shortlist` : `Add ${opportunity.title} to shortlist`}
            onClick={() => void toggleShortlisted(opportunity.id)}
            className="shrink-0 rounded-md p-1.5 text-foreground-subtle hover:bg-surface-muted hover:text-brand focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus-ring)]"
          >
            {shortlisted ? (
              <BookmarkCheck className="h-5 w-5 text-brand" aria-hidden="true" />
            ) : (
              <Bookmark className="h-5 w-5" aria-hidden="true" />
            )}
          </button>
        </div>

        <h3 className="text-base font-semibold leading-snug text-foreground">
          <Link
            href={`/opportunities/${opportunity.slug}`}
            className="rounded hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus-ring)]"
          >
            {opportunity.title}
          </Link>
        </h3>

        <div className="flex items-center gap-1.5 text-sm text-foreground-muted">
          <MapPin className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span className="break-words">{location || "Location not specified"}</span>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {opportunity.studyLevels.map((level) => (
            <span key={level} className="rounded-full bg-surface-muted px-2 py-0.5 text-xs text-foreground-muted">
              {level}
            </span>
          ))}
        </div>

        <p className="line-clamp-2 text-sm text-foreground-muted">{opportunity.benefitSummary}</p>

        <div className="mt-auto flex flex-col gap-1.5 pt-2">
          <div className="flex flex-wrap items-center gap-2">
            <DeadlineBadge evaluation={evaluation} />
            <DeadlineCountdownText evaluation={evaluation} />
          </div>
          <p className="line-clamp-1 text-xs text-foreground-subtle" title={opportunity.deadlineRawText}>
            Original wording: &ldquo;{opportunity.deadlineRawText}&rdquo;
          </p>
          <VerificationBadge kind={opportunity.kind} verificationRequired={evaluation.verificationRequired} />
        </div>

        {progress && progress.total > 0 ? (
          <p className="text-xs text-foreground-subtle">
            Checklist: {progress.done}/{progress.total} complete
          </p>
        ) : null}
      </CardBody>
      <CardFooter className="flex flex-wrap items-center justify-between gap-2">
        <Button variant="outline" size="sm" asChild>
          <Link href={`/opportunities/${opportunity.slug}`}>View details</Link>
        </Button>
        {opportunity.officialUrl ? (
          <a
            href={opportunity.officialUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 rounded text-sm text-foreground-muted hover:text-foreground hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus-ring)]"
          >
            Official website
            <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
            <span className="sr-only">(opens in a new tab)</span>
          </a>
        ) : null}
      </CardFooter>
    </Card>
  );
}
