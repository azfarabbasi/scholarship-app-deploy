import { describe, expect, it } from "vitest";
import {
  CLOUD_EXPORT_APP_ID,
  CLOUD_EXPORT_SCHEMA_VERSION,
  containsDangerousKeys,
  validateCloudExportPayload,
} from "@/lib/schemas/cloud-export";

const validUuid = "22222222-2222-4222-8222-222222222222";
const opportunityUuid = "33333333-3333-4333-8333-333333333333";

function samplePayload(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    app: CLOUD_EXPORT_APP_ID,
    schemaVersion: CLOUD_EXPORT_SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    profile: {
      displayName: "Ada",
      countryOrRegion: null,
      currentStudyLevel: null,
      intendedStudyLevel: null,
      graduationYear: null,
      targetIntakeYear: null,
      targetIntakeTerm: null,
      preferredCountries: [],
      preferredStudyLevels: [],
      onboardingCompletedAt: null,
    },
    tracking: [
      {
        id: validUuid,
        opportunityId: opportunityUuid,
        shortlisted: true,
        stage: "not-started",
        personalDeadline: null,
        priority: null,
        archived: false,
        lastViewedAt: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ],
    notes: [],
    checklistTasks: [],
    customOpportunities: [],
    planningPreferences: null,
    displayPreferences: null,
    syncMetadata: null,
    ...overrides,
  };
}

describe("containsDangerousKeys", () => {
  it("detects a top-level __proto__ key", () => {
    expect(containsDangerousKeys(JSON.parse('{"__proto__": {"polluted": true}}'))).toBe(true);
  });

  it("detects a nested constructor key", () => {
    expect(containsDangerousKeys({ profile: { constructor: { polluted: true } } })).toBe(true);
  });

  it("allows ordinary objects", () => {
    expect(containsDangerousKeys(samplePayload())).toBe(false);
  });
});

describe("validateCloudExportPayload", () => {
  it("accepts a well-formed export", () => {
    const result = validateCloudExportPayload(samplePayload());
    expect(result.valid).toBe(true);
    if (result.valid) {
      expect(result.summary.trackingCount).toBe(1);
    }
  });

  it("rejects a payload containing prototype-pollution keys", () => {
    const poisoned = JSON.parse('{"__proto__": {}}');
    const result = validateCloudExportPayload(poisoned);
    expect(result.valid).toBe(false);
  });

  it("rejects the wrong app identifier", () => {
    const result = validateCloudExportPayload(samplePayload({ app: "some-other-app" }));
    expect(result.valid).toBe(false);
  });

  it("rejects an unrecognised extra field (strict schema)", () => {
    const payload = samplePayload();
    (payload as Record<string, unknown>).staffAuditLog = [{ actorStaffProfileId: "x" }];
    const result = validateCloudExportPayload(payload);
    expect(result.valid).toBe(false);
  });

  it("rejects a malformed tracking row", () => {
    const payload = samplePayload({ tracking: [{ id: "not-a-uuid" }] });
    const result = validateCloudExportPayload(payload);
    expect(result.valid).toBe(false);
  });

  it("rejects an invalid stage enum value", () => {
    const payload = samplePayload();
    (payload.tracking as Array<Record<string, unknown>>)[0].stage = "definitely-not-a-stage";
    const result = validateCloudExportPayload(payload);
    expect(result.valid).toBe(false);
  });
});

describe("validateCloudExportPayload: Checkpoint 4 fields", () => {
  it("still accepts an export with no Checkpoint 4 fields at all (pre-Checkpoint-4 shape)", () => {
    const result = validateCloudExportPayload(samplePayload());
    expect(result.valid).toBe(true);
    if (result.valid) {
      expect(result.summary.savedSearchCount).toBe(0);
      expect(result.summary.reminderCount).toBe(0);
    }
  });

  it("accepts and counts eligibility answers, saved searches, reminder preferences, reminders, and notifications", () => {
    const payload = samplePayload({
      eligibilityAnswers: {
        countryOfResidence: null,
        nationality: "Germany",
        currentStudyLevel: null,
        intendedStudyLevel: null,
        fieldsOfInterest: [],
        graduationYear: null,
        targetIntakeYear: null,
        targetIntakeTerm: null,
        preferredCountries: [],
        preferredRegions: [],
        languageTestStatus: null,
        researchExperience: null,
        workExperienceYears: null,
        finalYearStatus: null,
        fundingPreference: null,
        studyMode: null,
      },
      savedSearches: [
        {
          id: validUuid,
          name: "Germany scholarships",
          queryText: "",
          filters: {},
          sortMode: "relevance",
          resultCountSnapshot: 0,
          resultSnapshot: [],
          lastCheckedAt: null,
          alertsEnabled: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ],
      reminderPreferences: { remindersEnabled: true, officialLeadDays: [7], personalLeadDays: [1], savedSearchAlertsEnabled: true },
      reminders: [
        {
          id: validUuid,
          stableKey: "official-deadline:opp-1:2027-03-01:7",
          source: "official-deadline",
          targetType: "built-in",
          targetId: opportunityUuid,
          title: "Official deadline",
          dueAt: new Date().toISOString(),
          leadDays: 7,
          status: "pending",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ],
      notifications: [
        {
          id: validUuid,
          type: "system",
          source: "system",
          title: "Hello",
          message: "",
          targetType: null,
          targetId: null,
          savedSearchId: null,
          dueAt: null,
          status: "unread",
          readAt: null,
          createdAt: new Date().toISOString(),
        },
      ],
    });

    const result = validateCloudExportPayload(payload);
    expect(result.valid).toBe(true);
    if (result.valid) {
      expect(result.payload.eligibilityAnswers?.nationality).toBe("Germany");
      expect(result.summary.savedSearchCount).toBe(1);
      expect(result.summary.reminderCount).toBe(1);
    }
  });

  it("rejects a saved search with an unrecognised extra field (strict schema)", () => {
    const payload = samplePayload({
      savedSearches: [
        {
          id: validUuid,
          name: "x",
          queryText: "",
          filters: {},
          sortMode: "relevance",
          resultCountSnapshot: 0,
          resultSnapshot: [],
          lastCheckedAt: null,
          alertsEnabled: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          notAllowedField: true,
        },
      ],
    });
    expect(validateCloudExportPayload(payload).valid).toBe(false);
  });

  it("rejects an invalid reminder status enum value", () => {
    const payload = samplePayload({
      reminders: [
        {
          id: validUuid,
          stableKey: "x",
          source: "personal-deadline",
          targetType: "built-in",
          targetId: opportunityUuid,
          title: "x",
          dueAt: new Date().toISOString(),
          leadDays: 1,
          status: "not-a-real-status",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ],
    });
    expect(validateCloudExportPayload(payload).valid).toBe(false);
  });
});

describe("validateCloudExportPayload: security hardening (Phase 2)", () => {
  it("rejects a schema version newer than this app supports", () => {
    const result = validateCloudExportPayload(samplePayload({ schemaVersion: CLOUD_EXPORT_SCHEMA_VERSION + 1 }));
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.errors.join(" ")).toMatch(/newer version/i);
    }
  });

  it("rejects a schema version below the minimum supported version", () => {
    // 0 fails the Zod-level `.positive()` bound rather than the dedicated
    // "too old" message below it — the minimum supported version is
    // currently 1, the same floor Zod itself enforces, so there is no
    // in-range value that reaches the "too old" branch yet. Either way, the
    // payload must be rejected.
    const result = validateCloudExportPayload(samplePayload({ schemaVersion: 0 }));
    expect(result.valid).toBe(false);
  });

  it("accepts the current schema version and the minimum supported one", () => {
    expect(validateCloudExportPayload(samplePayload({ schemaVersion: CLOUD_EXPORT_SCHEMA_VERSION })).valid).toBe(true);
    expect(validateCloudExportPayload(samplePayload({ schemaVersion: 1 })).valid).toBe(true);
  });

  it("rejects a custom opportunity officialUrl using a javascript: scheme", () => {
    const payload = samplePayload({
      customOpportunities: [
        {
          id: validUuid,
          slug: "my-scholarship",
          title: "My Scholarship",
          opportunityType: "scholarship",
          providerName: null,
          countries: [],
          regions: [],
          studyLevels: [],
          benefitSummary: "",
          eligibilitySummary: "",
          officialUrl: "javascript:alert(1)",
          deadlineKind: "unknown",
          deadlineRawText: "",
          deadlineDate: null,
          deadlineTimezone: null,
          verificationNotes: null,
          archivedAt: null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ],
    });
    expect(validateCloudExportPayload(payload).valid).toBe(false);
  });

  it("accepts a custom opportunity officialUrl using https:", () => {
    const payload = samplePayload({
      customOpportunities: [
        {
          id: validUuid,
          slug: "my-scholarship",
          title: "My Scholarship",
          opportunityType: "scholarship",
          providerName: null,
          countries: [],
          regions: [],
          studyLevels: [],
          benefitSummary: "",
          eligibilitySummary: "",
          officialUrl: "https://example.test/scholarship",
          deadlineKind: "unknown",
          deadlineRawText: "",
          deadlineDate: null,
          deadlineTimezone: null,
          verificationNotes: null,
          archivedAt: null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ],
    });
    expect(validateCloudExportPayload(payload).valid).toBe(true);
  });

  it("rejects a tracking array over the row-count cap", () => {
    const oversized = Array.from({ length: 5001 }, (_, i) => ({
      id: `44444444-4444-4444-8444-${String(i).padStart(12, "0")}`,
      opportunityId: opportunityUuid,
      shortlisted: false,
      stage: "not-started",
      personalDeadline: null,
      priority: null,
      archived: false,
      lastViewedAt: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }));
    const result = validateCloudExportPayload(samplePayload({ tracking: oversized }));
    expect(result.valid).toBe(false);
  });

  it("rejects an oversized string field", () => {
    const payload = samplePayload();
    payload.profile.displayName = "x".repeat(10_000);
    const result = validateCloudExportPayload(payload);
    expect(result.valid).toBe(false);
  });
});
