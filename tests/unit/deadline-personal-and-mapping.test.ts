import { describe, expect, it } from "vitest";
import { daysBetweenIsoDates, isValidIsoDate } from "@/lib/deadlines/calendar-math";
import { evaluatePersonalDeadline } from "@/lib/deadlines/personal";
import { mapLegacyVerificationStatus, seedDeadlineToEvaluationInput } from "@/lib/deadlines/seed-adapter";
import { evaluateDeadline } from "@/lib/deadlines/engine";

describe("personal deadlines (distinct from official deadlines)", () => {
  it("reports upcoming for a future date", () => {
    const result = evaluatePersonalDeadline("2027-01-20", new Date("2027-01-15T12:00:00Z"));
    expect(result?.state).toBe("upcoming");
    expect(result?.days).toBe(5);
  });

  it("reports due today", () => {
    const result = evaluatePersonalDeadline("2027-01-15", new Date("2027-01-15T12:00:00Z"));
    expect(result?.state).toBe("due-today");
    expect(result?.days).toBe(0);
  });

  it("reports overdue for a past date", () => {
    const result = evaluatePersonalDeadline("2027-01-10", new Date("2027-01-15T12:00:00Z"));
    expect(result?.state).toBe("overdue");
    expect(result?.days).toBe(5);
  });

  it("returns null when no personal deadline is set", () => {
    expect(evaluatePersonalDeadline(null, new Date())).toBeNull();
  });

  it("flags a malformed personal deadline as invalid without throwing", () => {
    const result = evaluatePersonalDeadline("2027-02-30", new Date("2027-01-01T00:00:00Z"));
    expect(result?.state).toBe("invalid");
  });

  it("never lets a personal deadline set the official verification/lifecycle state", () => {
    // Personal deadlines have their own evaluator entirely, so they cannot by
    // construction touch DeadlineEvaluationResult. This test documents that
    // guarantee structurally: the personal result type has no lifecycle field.
    const result = evaluatePersonalDeadline("2027-01-20", new Date("2027-01-15T12:00:00Z"));
    expect(result).not.toHaveProperty("lifecycleStatus");
    expect(result).not.toHaveProperty("verificationRequired");
  });
});

describe("calendar-math", () => {
  it("accepts a valid leap day", () => {
    expect(isValidIsoDate("2028-02-29")).toBe(true);
  });

  it("rejects a non-leap-year Feb 29", () => {
    expect(isValidIsoDate("2027-02-29")).toBe(false);
  });

  it("rejects an impossible calendar date", () => {
    expect(isValidIsoDate("2027-02-30")).toBe(false);
  });

  it("computes calendar-day differences without ms/86400000 rounding bugs", () => {
    expect(daysBetweenIsoDates("2027-01-01", "2027-01-31")).toBe(30);
    expect(daysBetweenIsoDates("2028-02-01", "2028-03-01")).toBe(29); // leap year February
    expect(daysBetweenIsoDates("2027-02-01", "2027-03-01")).toBe(28);
  });
});

describe("legacy verification status mapping", () => {
  it("maps not-reverified to unverified (one-way, never to verified)", () => {
    expect(mapLegacyVerificationStatus("not-reverified")).toBe("unverified");
  });

  it("maps needs-review to unverified", () => {
    expect(mapLegacyVerificationStatus("needs-review")).toBe("unverified");
  });

  it("maps verified to verified", () => {
    expect(mapLegacyVerificationStatus("verified")).toBe("verified");
  });
});

describe("seed adapter + built-in/custom distinction via the engine", () => {
  it("never lets a not-reverified exact seed deadline produce Apply now", () => {
    const input = seedDeadlineToEvaluationInput(
      {
        rawText: "Apply by 1 March 2027",
        precision: "exact",
        dates: ["2027-03-01"],
        cycleYear: 2027,
        timezone: null,
        isRolling: false,
      },
      { sourceType: "legacy-prototype", sourceReference: "x", verificationStatus: "not-reverified", lastCheckedAt: null },
    );
    const result = evaluateDeadline(input, new Date("2027-01-01T00:00:00Z"));
    expect(result.studentFacingLabel).toBe("Verify deadline");
    expect(result.countdown.allowed).toBe(false);
  });
});
