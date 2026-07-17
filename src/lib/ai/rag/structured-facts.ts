import { evaluateDeadline } from "@/lib/deadlines/engine";
import type { CatalogueOpportunity } from "@/lib/catalogue/types";
import type { MatchResult } from "@/lib/matching/types";
import type { StructuredFact } from "./types";

/**
 * Turns already-computed, already-published facts (deadline evaluation,
 * eligibility rules, funding categories, document counts, and — when
 * supplied — a deterministic `MatchResult`) into the `StructuredFact` shape
 * the assistant prompt and citation system both consume. Never calls an AI
 * provider and never invents a value: every field here traces back to a
 * column the public catalogue repository already exposes (see
 * `src/lib/catalogue/db-repository.ts`), so a stale or missing fact shows up
 * as "unknown"/"unverified" here exactly as it would on the opportunity's own
 * page — the assistant can never know more than the published record does.
 */

function deadlineFact(opportunity: CatalogueOpportunity): StructuredFact {
  const evaluation = evaluateDeadline(opportunity.deadlineInput, new Date());
  const selected = evaluation.selectedOccurrence;
  return {
    kind: "deadline",
    citationType: "structured-data",
    opportunityId: opportunity.id,
    opportunityTitle: opportunity.title,
    label: `${opportunity.title} — deadline status`,
    attributes: {
      precision: opportunity.deadlineInput.precision,
      "deadline-verification": opportunity.deadlineInput.verificationStatus,
      "deadline-date": selected?.sourceDate ?? selected?.projectedDate ?? "",
      "deadline-status-text": evaluation.statusText,
      "deadline-raw-text": opportunity.deadlineRawText,
    },
    officialUrl: opportunity.officialUrl,
    checkedAt: selected?.lastCheckedAt ?? opportunity.verification.lastCheckedAt,
    verificationStatus: opportunity.deadlineInput.verificationStatus,
  };
}

function documentsFact(opportunity: CatalogueOpportunity): StructuredFact {
  return {
    kind: "documents",
    citationType: "structured-data",
    opportunityId: opportunity.id,
    opportunityTitle: opportunity.title,
    label: `${opportunity.title} — required documents`,
    attributes: {
      "document-count": String(opportunity.verification.documentCount),
      "documents-verified": String(opportunity.verification.documentsVerified),
    },
    officialUrl: opportunity.officialUrl,
    checkedAt: opportunity.verification.lastCheckedAt,
    verificationStatus: opportunity.verification.documentsVerified ? "verified" : "unverified",
  };
}

function eligibilityFact(opportunity: CatalogueOpportunity): StructuredFact | null {
  if (opportunity.eligibilityRules.length === 0) {
    return null;
  }
  return {
    kind: "eligibility",
    citationType: "structured-data",
    opportunityId: opportunity.id,
    opportunityTitle: opportunity.title,
    label: `${opportunity.title} — eligibility rules`,
    attributes: {
      "eligibility-rule-count": String(opportunity.eligibilityRules.length),
      "eligibility-summary": opportunity.eligibilitySummary,
      "eligibility-verified": String(opportunity.verification.eligibilityVerified),
    },
    officialUrl: opportunity.officialUrl,
    checkedAt: opportunity.verification.lastCheckedAt,
    verificationStatus: opportunity.verification.eligibilityVerified ? "verified" : "unverified",
  };
}

function fundingFact(opportunity: CatalogueOpportunity): StructuredFact | null {
  if (opportunity.fundingCategories.length === 0) {
    return null;
  }
  return {
    kind: "funding",
    citationType: "structured-data",
    opportunityId: opportunity.id,
    opportunityTitle: opportunity.title,
    label: `${opportunity.title} — funding`,
    attributes: {
      "funding-categories": opportunity.fundingCategories.join(", "),
      "funding-summary": opportunity.benefitSummary,
    },
    officialUrl: opportunity.officialUrl,
    checkedAt: opportunity.verification.lastCheckedAt,
    verificationStatus: opportunity.verification.status,
  };
}

/** One structured fact per opportunity dimension (deadline, documents, eligibility, funding) — used for general/opportunity/comparison scopes. */
export function buildOpportunityStructuredFacts(opportunity: CatalogueOpportunity): StructuredFact[] {
  return [deadlineFact(opportunity), documentsFact(opportunity), eligibilityFact(opportunity), fundingFact(opportunity)].filter(
    (fact): fact is StructuredFact => fact !== null,
  );
}

/**
 * The matching-explanation scope's one, load-bearing fact: the deterministic
 * engine's own output, never re-derived or second-guessed by the assistant.
 */
export function buildMatchStructuredFact(opportunity: CatalogueOpportunity, match: MatchResult): StructuredFact {
  return {
    kind: "matching",
    citationType: "match-explanation",
    opportunityId: opportunity.id,
    opportunityTitle: opportunity.title,
    label: `${opportunity.title} — deterministic match result`,
    attributes: {
      "match-label": match.label,
      "match-confidence": match.confidence,
      "match-next-action": match.nextAction,
      "match-positive-count": String(match.positiveReasons.length),
      "match-mismatch-count": String(match.mismatchReasons.length),
      "match-missing-count": String(match.missingInfoReasons.length),
    },
    officialUrl: opportunity.officialUrl,
    checkedAt: opportunity.verification.lastCheckedAt,
    verificationStatus: opportunity.verification.status,
  };
}
