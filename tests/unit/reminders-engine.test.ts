import { describe, expect, it } from "vitest";
import { UNVERIFIED_CATALOGUE_VERIFICATION, type CatalogueOpportunity } from "@/lib/catalogue/types";
import type { DeadlineEvaluationInput, DeadlineOccurrenceFact } from "@/lib/deadlines/types";
import { generateReminderCandidates, type ReminderSourceItem } from "@/lib/reminders/engine";
import { extractExactVerifiedDeadline } from "@/lib/reminders/extract";
import { isReminderActive, isReminderOverdue } from "@/lib/reminders/status";

function makeOccurrence(overrides: Partial<DeadlineOccurrenceFact> = {}): DeadlineOccurrenceFact {
  return {
    kind: "closing",
    scope: "universal",
    scopeReference: null,
    rawText: "Closes 1 March 2027",
    officialUrl: null,
    lastCheckedAt: null,
    sourceTimezone: "UTC",
    sourceDate: "2027-03-01",
    sourceDateTime: null,
    projectedDate: null,
    ...overrides,
  };
}

function makeDeadlineInput(overrides: Partial<DeadlineEvaluationInput> = {}): DeadlineEvaluationInput {
  return {
    cycleYear: 2027,
    precision: "exact",
    verificationStatus: "verified",
    recurrence: { cadence: "none", automaticDateGenerationAllowed: false },
    occurrences: [makeOccurrence()],
    ...overrides,
  };
}

function makeOpportunity(deadlineInput: DeadlineEvaluationInput): CatalogueOpportunity {
  return {
    kind: "built-in",
    id: "built-in-1",
    legacyId: 1,
    slug: "test-opportunity",
    title: "Test Opportunity",
    opportunityType: "scholarship",
    providerName: "Test Provider",
    countries: ["Germany"],
    regions: [],
    studyLevels: ["Master"],
    benefitSummary: "Full funding",
    eligibilitySummary: "Open to all applicants",
    officialUrl: "https://example.invalid",
    verificationNotes: null,
    eligibilityRules: [],
    fundingCategories: [],
    verification: UNVERIFIED_CATALOGUE_VERIFICATION,
    deadlineRawText: "1 March 2027",
    deadlineInput,
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
  };
}

describe("extractExactVerifiedDeadline", () => {
  it("returns the date only for an exact, verified, single-occurrence deadline", () => {
    const opportunity = makeOpportunity(makeDeadlineInput());
    expect(extractExactVerifiedDeadline(opportunity)).toBe("2027-03-01");
  });

  it("prefers sourceDateTime over sourceDate when both are present", () => {
    const opportunity = makeOpportunity(
      makeDeadlineInput({ occurrences: [makeOccurrence({ sourceDateTime: "2027-03-01T23:59:00Z" })] }),
    );
    expect(extractExactVerifiedDeadline(opportunity)).toBe("2027-03-01T23:59:00Z");
  });

  it.each(["estimated", "rolling", "unknown", "program-specific", "institution-specific"] as const)(
    "returns null for precision '%s'",
    (precision) => {
      const opportunity = makeOpportunity(makeDeadlineInput({ precision }));
      expect(extractExactVerifiedDeadline(opportunity)).toBeNull();
    },
  );

  it.each(["unverified", "stale", "conflicting", "withdrawn", "archived", "estimated-from-previous-cycle"] as const)(
    "returns null for verification status '%s'",
    (verificationStatus) => {
      const opportunity = makeOpportunity(makeDeadlineInput({ verificationStatus }));
      expect(extractExactVerifiedDeadline(opportunity)).toBeNull();
    },
  );

  it("returns null when there are zero candidate occurrences", () => {
    const opportunity = makeOpportunity(makeDeadlineInput({ occurrences: [] }));
    expect(extractExactVerifiedDeadline(opportunity)).toBeNull();
  });

  it("returns null when there is more than one candidate occurrence, even if all are exact/verified", () => {
    const opportunity = makeOpportunity(
      makeDeadlineInput({ occurrences: [makeOccurrence(), makeOccurrence({ scope: "program-specific", scopeReference: "prog-a" })] }),
    );
    expect(extractExactVerifiedDeadline(opportunity)).toBeNull();
  });

  it("returns null when the single occurrence carries no date at all", () => {
    const opportunity = makeOpportunity(
      makeDeadlineInput({ occurrences: [makeOccurrence({ sourceDate: null, sourceDateTime: null })] }),
    );
    expect(extractExactVerifiedDeadline(opportunity)).toBeNull();
  });
});

describe("generateReminderCandidates", () => {
  const now = new Date("2027-01-01T00:00:00Z");

  it("generates one candidate per configured lead day for an official exact deadline", () => {
    const items: ReminderSourceItem[] = [
      { targetType: "built-in", targetId: "opp-1", title: "Scholarship A", officialExactDeadline: "2027-03-01", personalDeadline: null },
    ];
    const candidates = generateReminderCandidates(items, { officialLeadDays: [7, 1], personalLeadDays: [] }, now);
    expect(candidates).toHaveLength(2);
    expect(candidates.every((c) => c.source === "official-deadline")).toBe(true);
    expect(candidates.map((c) => c.leadDays).sort()).toEqual([1, 7]);
  });

  it("generates one candidate per configured lead day for a personal deadline", () => {
    const items: ReminderSourceItem[] = [
      { targetType: "custom", targetId: "custom-1", title: "My tracked opportunity", officialExactDeadline: null, personalDeadline: "2027-04-01" },
    ];
    const candidates = generateReminderCandidates(items, { officialLeadDays: [], personalLeadDays: [1, 7] }, now);
    expect(candidates).toHaveLength(2);
    expect(candidates.every((c) => c.source === "personal-deadline")).toBe(true);
  });

  it("generates both official and personal reminders for the same item when both deadlines are present", () => {
    const items: ReminderSourceItem[] = [
      { targetType: "built-in", targetId: "opp-1", title: "Scholarship A", officialExactDeadline: "2027-03-01", personalDeadline: "2027-02-15" },
    ];
    const candidates = generateReminderCandidates(items, { officialLeadDays: [7], personalLeadDays: [1] }, now);
    expect(candidates).toHaveLength(2);
    expect(candidates.map((c) => c.source).sort()).toEqual(["official-deadline", "personal-deadline"]);
  });

  it("generates nothing for an item with neither an official nor a personal deadline", () => {
    const items: ReminderSourceItem[] = [
      { targetType: "built-in", targetId: "opp-1", title: "Scholarship A", officialExactDeadline: null, personalDeadline: null },
    ];
    expect(generateReminderCandidates(items, { officialLeadDays: [7], personalLeadDays: [7] }, now)).toHaveLength(0);
  });

  it("builds a deterministic, unique stableKey per source/target/date/leadDays combination", () => {
    const items: ReminderSourceItem[] = [
      { targetType: "built-in", targetId: "opp-1", title: "Scholarship A", officialExactDeadline: "2027-03-01", personalDeadline: null },
    ];
    const candidates = generateReminderCandidates(items, { officialLeadDays: [7], personalLeadDays: [] }, now);
    expect(candidates[0].stableKey).toBe("official-deadline:opp-1:2027-03-01:7");
  });

  it("never backfills a reminder whose remind-at time is more than 24h in the past", () => {
    const farInThePast = new Date("2027-06-01T00:00:00Z"); // "now" is long after the deadline + lead window
    const items: ReminderSourceItem[] = [
      { targetType: "built-in", targetId: "opp-1", title: "Scholarship A", officialExactDeadline: "2027-03-01", personalDeadline: null },
    ];
    const candidates = generateReminderCandidates(items, { officialLeadDays: [7], personalLeadDays: [] }, farInThePast);
    expect(candidates).toHaveLength(0);
  });

  it("still includes a reminder whose remind-at time is recent past (within the 24h backfill window)", () => {
    // remind-at = deadline - 0 lead days = 2027-03-01; "now" is a few hours later, well within 24h.
    const justAfter = new Date("2027-03-01T10:00:00Z");
    const items: ReminderSourceItem[] = [
      { targetType: "built-in", targetId: "opp-1", title: "Scholarship A", officialExactDeadline: "2027-03-01T00:00:00Z", personalDeadline: null },
    ];
    const candidates = generateReminderCandidates(items, { officialLeadDays: [0], personalLeadDays: [] }, justAfter);
    expect(candidates).toHaveLength(1);
  });
});

describe("reminder status: active and overdue", () => {
  const now = new Date("2027-02-22T00:00:00Z");

  it("is not active when status isn't pending, regardless of timing", () => {
    expect(isReminderActive({ dueAt: "2027-02-20T00:00:00Z", leadDays: 7, status: "dismissed" }, now)).toBe(false);
    expect(isReminderActive({ dueAt: "2027-02-20T00:00:00Z", leadDays: 7, status: "completed" }, now)).toBe(false);
  });

  it("is not active before the lead window opens", () => {
    // due 2027-03-01, lead 7 days -> opens 2027-02-22; "now" is one day earlier.
    const earlier = new Date("2027-02-21T00:00:00Z");
    expect(isReminderActive({ dueAt: "2027-03-01T00:00:00Z", leadDays: 7, status: "pending" }, earlier)).toBe(false);
  });

  it("is active once now reaches dueAt minus leadDays, but not yet overdue", () => {
    expect(isReminderActive({ dueAt: "2027-03-01T00:00:00Z", leadDays: 7, status: "pending" }, now)).toBe(true);
    expect(isReminderOverdue({ dueAt: "2027-03-01T00:00:00Z", leadDays: 7, status: "pending" }, now)).toBe(false);
  });

  it("is overdue once the due date itself has passed", () => {
    const pastDue = new Date("2027-03-02T00:00:00Z");
    expect(isReminderActive({ dueAt: "2027-03-01T00:00:00Z", leadDays: 7, status: "pending" }, pastDue)).toBe(true);
    expect(isReminderOverdue({ dueAt: "2027-03-01T00:00:00Z", leadDays: 7, status: "pending" }, pastDue)).toBe(true);
  });
});
