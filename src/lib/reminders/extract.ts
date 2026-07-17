import type { CatalogueOpportunity } from "@/lib/catalogue/types";

/**
 * Returns an ISO date/time only when the opportunity has exactly one
 * candidate deadline occurrence, its precision is `exact`, and its
 * verification status is `verified` — the one case where scheduling an
 * "official deadline" reminder is safe. Every other precision (estimated,
 * rolling, unknown, program-specific, institution-specific) or multiple
 * candidate occurrences returns `null`, deliberately, per
 * `docs/checkpoint-4/reminders-and-notifications.md`.
 */
export function extractExactVerifiedDeadline(opportunity: CatalogueOpportunity): string | null {
  const { deadlineInput } = opportunity;
  if (deadlineInput.precision !== "exact") return null;
  if (deadlineInput.verificationStatus !== "verified") return null;
  if (deadlineInput.occurrences.length !== 1) return null;

  const occurrence = deadlineInput.occurrences[0];
  const date = occurrence.sourceDateTime ?? occurrence.sourceDate;
  if (!date) return null;
  return date;
}
