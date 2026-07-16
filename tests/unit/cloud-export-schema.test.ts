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
