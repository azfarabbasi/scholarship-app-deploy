import { describe, expect, it } from "vitest";
import {
  checklistTaskInputSchema,
  displayPreferencesInputSchema,
  noteInputSchema,
  planningPreferencesInputSchema,
  studentProfileInputSchema,
  trackingPatchSchema,
} from "@/lib/schemas/student-workspace";

const validUuid = "11111111-1111-4111-8111-111111111111";

describe("studentProfileInputSchema", () => {
  it("accepts every field being absent (all optional, minimal profile)", () => {
    const result = studentProfileInputSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it("accepts a fully filled-in profile", () => {
    const result = studentProfileInputSchema.safeParse({
      displayName: "Ada",
      countryOrRegion: "Germany",
      currentStudyLevel: "Bachelor",
      intendedStudyLevel: "Master",
      graduationYear: 2027,
      targetIntakeYear: 2028,
      targetIntakeTerm: "Fall",
      preferredCountries: ["Germany", "Netherlands"],
      preferredStudyLevels: ["Master"],
    });
    expect(result.success).toBe(true);
  });

  it("rejects an unrecognised field (strict schema, no sensitive/unsupported fields accepted)", () => {
    const result = studentProfileInputSchema.safeParse({ dateOfBirth: "2000-01-01" });
    expect(result.success).toBe(false);
  });

  it("rejects passport/financial-shaped fields even if named plausibly", () => {
    const result = studentProfileInputSchema.safeParse({ passportNumber: "X1234567" });
    expect(result.success).toBe(false);
  });

  it("rejects an out-of-range graduation year", () => {
    const result = studentProfileInputSchema.safeParse({ graduationYear: 1500 });
    expect(result.success).toBe(false);
  });
});

describe("trackingPatchSchema", () => {
  it("accepts a partial patch", () => {
    expect(trackingPatchSchema.safeParse({ shortlisted: true }).success).toBe(true);
    expect(trackingPatchSchema.safeParse({ stage: "submitted" }).success).toBe(true);
    expect(trackingPatchSchema.safeParse({ priority: 3 }).success).toBe(true);
  });

  it("rejects an invalid stage value", () => {
    expect(trackingPatchSchema.safeParse({ stage: "not-a-real-stage" }).success).toBe(false);
  });

  it("rejects a priority outside 1-5", () => {
    expect(trackingPatchSchema.safeParse({ priority: 0 }).success).toBe(false);
    expect(trackingPatchSchema.safeParse({ priority: 6 }).success).toBe(false);
  });
});

describe("noteInputSchema", () => {
  it("accepts a valid note", () => {
    const result = noteInputSchema.safeParse({ targetType: "built-in", targetId: validUuid, noteText: "Remember to ask for a reference." });
    expect(result.success).toBe(true);
  });

  it("rejects a non-uuid targetId", () => {
    const result = noteInputSchema.safeParse({ targetType: "built-in", targetId: "not-a-uuid", noteText: "x" });
    expect(result.success).toBe(false);
  });

  it("rejects an invalid targetType", () => {
    const result = noteInputSchema.safeParse({ targetType: "staff-opportunity", targetId: validUuid, noteText: "x" });
    expect(result.success).toBe(false);
  });
});

describe("checklistTaskInputSchema", () => {
  it("accepts a valid task and defaults sourceType", () => {
    const result = checklistTaskInputSchema.safeParse({ targetType: "custom", targetId: validUuid, taskText: "Request transcript" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.sourceType).toBe("user-created");
    }
  });

  it("rejects an empty task text", () => {
    const result = checklistTaskInputSchema.safeParse({ targetType: "custom", targetId: validUuid, taskText: "" });
    expect(result.success).toBe(false);
  });
});

describe("planningPreferencesInputSchema", () => {
  it("accepts a valid calendar date", () => {
    const result = planningPreferencesInputSchema.safeParse({ expectedGraduationDate: "2027-06-01" });
    expect(result.success).toBe(true);
  });

  it("rejects a malformed date", () => {
    const result = planningPreferencesInputSchema.safeParse({ expectedGraduationDate: "not-a-date" });
    expect(result.success).toBe(false);
  });
});

describe("displayPreferencesInputSchema", () => {
  it("accepts a valid theme and catalogue view", () => {
    expect(displayPreferencesInputSchema.safeParse({ theme: "dark", catalogueView: "list" }).success).toBe(true);
  });

  it("rejects an invalid theme", () => {
    expect(displayPreferencesInputSchema.safeParse({ theme: "neon" }).success).toBe(false);
  });
});
