import { describe, expect, it } from "vitest";
import { deriveCalendarEvents } from "@/lib/calendar/events";
import { buildIcsCalendar, buildSingleEventIcs } from "@/lib/calendar/ics";
import { UNVERIFIED_CATALOGUE_VERIFICATION, type CatalogueOpportunity } from "@/lib/catalogue/types";
import type { DeadlineEvaluationInput } from "@/lib/deadlines/types";
import type { WorkspaceRecord } from "@/lib/storage/types";

const NOW = new Date("2027-01-15T12:00:00Z");

function makeOpportunity(overrides: Partial<CatalogueOpportunity> & { deadlineInput: DeadlineEvaluationInput }): CatalogueOpportunity {
  return {
    kind: "built-in",
    id: "built-in-1",
    legacyId: 1,
    slug: "test-opportunity",
    title: "Test Opportunity",
    opportunityType: "scholarship",
    providerName: null,
    countries: ["Germany"],
    regions: [],
    studyLevels: ["Master"],
    benefitSummary: "Full funding",
    eligibilitySummary: "Open to all",
    officialUrl: "https://example.invalid",
    verificationNotes: null,
    eligibilityRules: [],
    fundingCategories: [],
    verification: UNVERIFIED_CATALOGUE_VERIFICATION,
    deadlineRawText: "Some date",
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

function makeWorkspaceRecord(overrides: Partial<WorkspaceRecord>): WorkspaceRecord {
  return {
    opportunityId: "built-in-1",
    shortlisted: false,
    stage: "not-started",
    notes: "",
    checklist: [],
    personalDeadline: null,
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

const verifiedExactInput: DeadlineEvaluationInput = {
  cycleYear: 2027,
  precision: "exact",
  verificationStatus: "verified",
  recurrence: { cadence: "none", automaticDateGenerationAllowed: false },
  occurrences: [
    {
      kind: "closing",
      scope: "universal",
      scopeReference: null,
      rawText: "Closes 1 March 2027",
      officialUrl: "https://example.invalid",
      lastCheckedAt: "2027-01-01T00:00:00Z",
      sourceTimezone: "UTC",
      sourceDate: "2027-03-01",
      sourceDateTime: null,
      projectedDate: null,
    },
  ],
};

const unverifiedRollingInput: DeadlineEvaluationInput = {
  cycleYear: null,
  precision: "rolling",
  verificationStatus: "unverified",
  recurrence: { cadence: "none", automaticDateGenerationAllowed: false },
  occurrences: [],
};

describe("calendar event derivation", () => {
  it("places a verified exact official deadline on the dated calendar", () => {
    const opportunity = makeOpportunity({ deadlineInput: verifiedExactInput });
    const { dated, undated } = deriveCalendarEvents([opportunity], [], NOW);
    expect(dated).toHaveLength(1);
    expect(dated[0].date).toBe("2027-03-01");
    expect(dated[0].source).toBe("official");
    expect(undated).toHaveLength(0);
  });

  it("leaves an uncertain (unverified/rolling) deadline undated", () => {
    const opportunity = makeOpportunity({ deadlineInput: unverifiedRollingInput });
    const { dated, undated } = deriveCalendarEvents([opportunity], [], NOW);
    expect(dated).toHaveLength(0);
    expect(undated).toHaveLength(1);
  });

  it("places a personal deadline on the dated calendar, distinct from the official one", () => {
    const opportunity = makeOpportunity({ deadlineInput: unverifiedRollingInput });
    const workspace = makeWorkspaceRecord({ personalDeadline: "2027-02-14" });
    const { dated } = deriveCalendarEvents([opportunity], [workspace], NOW);
    expect(dated).toHaveLength(1);
    expect(dated[0].source).toBe("personal");
    expect(dated[0].date).toBe("2027-02-14");
  });

  it("places a self-reported custom-opportunity exact deadline on the dated calendar", () => {
    const opportunity = makeOpportunity({
      kind: "custom",
      deadlineInput: {
        cycleYear: null,
        precision: "exact",
        verificationStatus: "unverified",
        recurrence: { cadence: "none", automaticDateGenerationAllowed: false },
        occurrences: [
          {
            kind: "closing",
            scope: "universal",
            scopeReference: null,
            rawText: "My own deadline",
            officialUrl: null,
            lastCheckedAt: null,
            sourceTimezone: null,
            sourceDate: "2027-04-01",
            sourceDateTime: null,
            projectedDate: null,
          },
        ],
      },
    });
    const { dated } = deriveCalendarEvents([opportunity], [], NOW);
    expect(dated).toHaveLength(1);
    expect(dated[0].source).toBe("custom");
  });
});

describe("ICS generation", () => {
  it("produces a valid VCALENDAR/VEVENT structure", () => {
    const opportunity = makeOpportunity({ deadlineInput: verifiedExactInput });
    const { dated } = deriveCalendarEvents([opportunity], [], NOW);
    const ics = buildIcsCalendar(dated, { now: NOW });

    expect(ics).toContain("BEGIN:VCALENDAR");
    expect(ics).toContain("VERSION:2.0");
    expect(ics).toContain("BEGIN:VEVENT");
    expect(ics).toContain("DTSTART;VALUE=DATE:20270301");
    expect(ics).toContain("DTEND;VALUE=DATE:20270302");
    expect(ics).toContain("END:VEVENT");
    expect(ics).toContain("END:VCALENDAR");
    expect(ics.endsWith("\r\n")).toBe(true);
  });

  it("exports a single event", () => {
    const opportunity = makeOpportunity({ deadlineInput: verifiedExactInput });
    const { dated } = deriveCalendarEvents([opportunity], [], NOW);
    const ics = buildSingleEventIcs(dated[0], { now: NOW });
    expect(ics.match(/BEGIN:VEVENT/g)).toHaveLength(1);
  });

  it("exports a personal deadline as its own event", () => {
    const opportunity = makeOpportunity({ deadlineInput: unverifiedRollingInput });
    const workspace = makeWorkspaceRecord({ personalDeadline: "2027-02-14" });
    const { dated } = deriveCalendarEvents([opportunity], [workspace], NOW);
    const ics = buildIcsCalendar(dated, { now: NOW });
    expect(ics).toContain("DTSTART;VALUE=DATE:20270214");
  });

  it("never includes private note content in the exported calendar", () => {
    const opportunity = makeOpportunity({ deadlineInput: verifiedExactInput });
    const workspace = makeWorkspaceRecord({
      personalDeadline: "2027-02-14",
      notes: "SECRET-PERSONAL-NOTE-CONTENT",
    });
    const { dated } = deriveCalendarEvents([opportunity], [workspace], NOW);
    const ics = buildIcsCalendar(dated, { now: NOW });
    expect(ics).not.toContain("SECRET-PERSONAL-NOTE-CONTENT");
  });

  it("escapes commas, semicolons, and newlines in text fields", () => {
    const opportunity = makeOpportunity({ title: "Award, Part 2; Extra", deadlineInput: verifiedExactInput });
    const { dated } = deriveCalendarEvents([opportunity], [], NOW);
    const ics = buildIcsCalendar(dated, { now: NOW });
    expect(ics).toContain("Award\\, Part 2\\; Extra");
  });
});
