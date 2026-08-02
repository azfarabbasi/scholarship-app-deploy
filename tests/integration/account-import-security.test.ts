import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import * as schema from "../../src/lib/db/schema";
import { db, client, uniqueSuffix } from "./helpers";

/**
 * `importMyAccountData` derives the caller's identity from
 * `getStudentSession()`, never from the imported file itself — mocking this
 * one function lets the test drive the Server Action as two distinct
 * students without needing real Supabase Auth cookies, while every database
 * side effect still runs for real against the local test Postgres instance
 * (see tests/integration/helpers.ts).
 */
vi.mock("@/lib/auth/student-session", () => ({
  getStudentSession: vi.fn(),
}));

const { getStudentSession } = await import("@/lib/auth/student-session");
const { importMyAccountData } = await import("../../src/lib/db/actions/student/data-controls");
const { CLOUD_EXPORT_APP_ID, CLOUD_EXPORT_SCHEMA_VERSION } = await import("../../src/lib/schemas/cloud-export");

const mockedGetStudentSession = vi.mocked(getStudentSession);

function sessionFor(studentProfileId: string) {
  return { studentProfileId, email: `${studentProfileId}@example.test`, displayName: null, onboardingCompletedAt: null };
}

function basePayload(overrides: Record<string, unknown> = {}) {
  return {
    app: CLOUD_EXPORT_APP_ID,
    schemaVersion: CLOUD_EXPORT_SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    profile: {
      displayName: null,
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
    tracking: [],
    notes: [],
    checklistTasks: [],
    customOpportunities: [],
    planningPreferences: null,
    displayPreferences: null,
    syncMetadata: null,
    ...overrides,
  };
}

describe("account import security — malicious two-user import (Phase 2 item 1)", () => {
  const suffix = uniqueSuffix();
  const victimId = "aaaaaaaa-1111-4aaa-8aaa-aaaaaaaaaaaa";
  const attackerId = "bbbbbbbb-2222-4bbb-8bbb-bbbbbbbbbbbb";

  beforeAll(async () => {
    await db.insert(schema.studentProfiles).values({ id: victimId, email: `victim-${suffix}@example.test` });
    await db.insert(schema.studentProfiles).values({ id: attackerId, email: `attacker-${suffix}@example.test` });
  });

  afterAll(async () => {
    await db.delete(schema.userCustomOpportunities).where(eq(schema.userCustomOpportunities.studentProfileId, victimId));
    await db.delete(schema.userCustomOpportunities).where(eq(schema.userCustomOpportunities.studentProfileId, attackerId));
    await db.delete(schema.studentProfiles).where(eq(schema.studentProfiles.id, victimId));
    await db.delete(schema.studentProfiles).where(eq(schema.studentProfiles.id, attackerId));
    await client.end();
  });

  it("cannot overwrite another student's custom opportunity by reusing its exported id and slug", async () => {
    const [victimRow] = await db
      .insert(schema.userCustomOpportunities)
      .values({
        studentProfileId: victimId,
        slug: "victim-scholarship",
        title: "Victim's Original Title",
        opportunityType: "scholarship",
        benefitSummary: "Original benefit summary.",
        eligibilitySummary: "Original eligibility summary.",
        deadlineKind: "unknown",
        deadlineRawText: "",
      })
      .returning();

    mockedGetStudentSession.mockResolvedValue(sessionFor(attackerId));

    const maliciousPayload = basePayload({
      customOpportunities: [
        {
          // Reuses the victim's own real row id and slug — as if this file had
          // leaked, or the id/slug had been guessed.
          id: victimRow.id,
          slug: "victim-scholarship",
          title: "HACKED BY ATTACKER",
          opportunityType: "scholarship",
          providerName: null,
          countries: [],
          regions: [],
          studyLevels: [],
          benefitSummary: "Attacker-controlled benefit summary.",
          eligibilitySummary: "Attacker-controlled eligibility summary.",
          officialUrl: null,
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

    const result = await importMyAccountData(maliciousPayload, "merge");
    expect(result.ok).toBe(true);
    expect(result.customOpportunitiesImported).toBe(1);

    const [victimAfter] = await db.select().from(schema.userCustomOpportunities).where(eq(schema.userCustomOpportunities.id, victimRow.id));
    expect(victimAfter.title).toBe("Victim's Original Title");
    expect(victimAfter.studentProfileId).toBe(victimId);

    const attackerRows = await db.select().from(schema.userCustomOpportunities).where(eq(schema.userCustomOpportunities.studentProfileId, attackerId));
    expect(attackerRows).toHaveLength(1);
    expect(attackerRows[0].id).not.toBe(victimRow.id);
    expect(attackerRows[0].title).toBe("HACKED BY ATTACKER");
  });

  it("re-importing the same payload for the same student updates their own row (legitimate upsert still works)", async () => {
    mockedGetStudentSession.mockResolvedValue(sessionFor(attackerId));

    const payload = basePayload({
      customOpportunities: [
        {
          id: "cccccccc-3333-4ccc-8ccc-cccccccccccc",
          slug: "my-own-scholarship",
          title: "First title",
          opportunityType: "scholarship",
          providerName: null,
          countries: [],
          regions: [],
          studyLevels: [],
          benefitSummary: "x",
          eligibilitySummary: "x",
          officialUrl: null,
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
    }) as { customOpportunities: Array<{ title: string }> };

    await importMyAccountData(payload, "merge");
    const updated = { ...payload, customOpportunities: [{ ...payload.customOpportunities[0], title: "Updated title" }] };
    const result = await importMyAccountData(updated, "merge");
    expect(result.ok).toBe(true);

    const rows = await db
      .select()
      .from(schema.userCustomOpportunities)
      .where(eq(schema.userCustomOpportunities.studentProfileId, attackerId));
    const ownRow = rows.find((r) => r.slug === "my-own-scholarship");
    expect(ownRow?.title).toBe("Updated title");
  });
});
