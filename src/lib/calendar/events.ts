import { evaluateDeadline } from "@/lib/deadlines/engine";
import type { CatalogueOpportunity, CatalogueOpportunityKind } from "@/lib/catalogue/types";
import type { WorkspaceRecord } from "@/lib/storage/types";

export type CalendarEventSource = "official" | "personal" | "custom";

export interface CalendarEvent {
  id: string;
  title: string;
  date: string;
  source: CalendarEventSource;
  opportunityId: string;
  opportunitySlug: string;
  opportunityKind: CatalogueOpportunityKind;
  officialUrl: string | null;
  description: string;
}

export interface UndatedCalendarEntry {
  id: string;
  title: string;
  reason: string;
  opportunityId: string;
  opportunitySlug: string;
  opportunityKind: CatalogueOpportunityKind;
}

export interface CalendarDerivationResult {
  dated: CalendarEvent[];
  undated: UndatedCalendarEntry[];
}

export function deriveCalendarEvents(
  opportunities: readonly CatalogueOpportunity[],
  workspaceRecords: readonly WorkspaceRecord[],
  now: Date,
): CalendarDerivationResult {
  const dated: CalendarEvent[] = [];
  const undated: UndatedCalendarEntry[] = [];
  const workspaceByOpportunity = new Map(workspaceRecords.map((record) => [record.opportunityId, record]));

  for (const opportunity of opportunities) {
    const evaluation = evaluateDeadline(opportunity.deadlineInput, now);
    const isSelfReportedExact =
      opportunity.kind === "custom" &&
      opportunity.deadlineInput.precision === "exact" &&
      opportunity.deadlineInput.occurrences[0]?.sourceDate;

    if (isSelfReportedExact) {
      dated.push({
        id: `deadline-${opportunity.id}`,
        title: `${opportunity.title} — deadline`,
        date: opportunity.deadlineInput.occurrences[0].sourceDate as string,
        source: "custom",
        opportunityId: opportunity.id,
        opportunitySlug: opportunity.slug,
        opportunityKind: opportunity.kind,
        officialUrl: opportunity.officialUrl,
        description: "Self-reported custom opportunity deadline. Not officially verified.",
      });
    } else if (evaluation.countdown.allowed && evaluation.selectedOccurrence?.sourceDate) {
      dated.push({
        id: `deadline-${opportunity.id}`,
        title: `${opportunity.title} — deadline`,
        date: evaluation.selectedOccurrence.sourceDate,
        source: "official",
        opportunityId: opportunity.id,
        opportunitySlug: opportunity.slug,
        opportunityKind: opportunity.kind,
        officialUrl: opportunity.officialUrl,
        description: evaluation.statusText,
      });
    } else {
      undated.push({
        id: `undated-${opportunity.id}`,
        title: opportunity.title,
        reason: evaluation.studentFacingLabel,
        opportunityId: opportunity.id,
        opportunitySlug: opportunity.slug,
        opportunityKind: opportunity.kind,
      });
    }

    const workspaceRecord = workspaceByOpportunity.get(opportunity.id);
    if (workspaceRecord?.personalDeadline) {
      dated.push({
        id: `personal-${opportunity.id}`,
        title: `${opportunity.title} — your personal deadline`,
        date: workspaceRecord.personalDeadline,
        source: "personal",
        opportunityId: opportunity.id,
        opportunitySlug: opportunity.slug,
        opportunityKind: opportunity.kind,
        officialUrl: null,
        description: "Personal reminder set by you. Not an official deadline.",
      });
    }
  }

  dated.sort((a, b) => a.date.localeCompare(b.date));
  return { dated, undated };
}
