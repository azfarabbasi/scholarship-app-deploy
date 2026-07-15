import { describe, expect, it } from "vitest";
import { customOpportunityInputSchema } from "@/lib/schemas/custom-opportunity";

const base = {
  title: "My Scholarship",
  opportunityType: "scholarship" as const,
  providerName: "",
  countries: ["Germany"],
  regions: [],
  studyLevels: ["Master" as const],
  benefitSummary: "Covers tuition and a stipend",
  eligibilitySummary: "Open to international applicants",
  officialUrl: "",
  deadlineKind: "exact" as const,
  deadlineRawText: "1 March 2027",
  deadlineDate: "2027-03-01",
  deadlineTimezone: "",
  verificationNotes: "",
};

describe("custom opportunity schema", () => {
  it("accepts a valid, fully-formed opportunity", () => {
    const result = customOpportunityInputSchema.safeParse(base);
    expect(result.success).toBe(true);
  });

  it("rejects a missing title", () => {
    const result = customOpportunityInputSchema.safeParse({ ...base, title: "" });
    expect(result.success).toBe(false);
  });

  it("rejects an invalid officialUrl", () => {
    const result = customOpportunityInputSchema.safeParse({ ...base, officialUrl: "not-a-url" });
    expect(result.success).toBe(false);
  });

  it("accepts an empty officialUrl as optional (converted to null)", () => {
    const result = customOpportunityInputSchema.safeParse({ ...base, officialUrl: "" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.officialUrl).toBeNull();
    }
  });

  it("requires at least one country or region", () => {
    const result = customOpportunityInputSchema.safeParse({ ...base, countries: [], regions: [] });
    expect(result.success).toBe(false);
  });

  it("requires at least one study level", () => {
    const result = customOpportunityInputSchema.safeParse({ ...base, studyLevels: [] });
    expect(result.success).toBe(false);
  });

  it("requires a calendar date when the deadline is exact", () => {
    const result = customOpportunityInputSchema.safeParse({ ...base, deadlineKind: "exact", deadlineDate: "" });
    expect(result.success).toBe(false);
  });

  it("rejects a malformed calendar date for an exact deadline", () => {
    const result = customOpportunityInputSchema.safeParse({ ...base, deadlineKind: "exact", deadlineDate: "2027-02-30" });
    expect(result.success).toBe(false);
  });

  it("accepts a rolling deadline with no calendar date", () => {
    const result = customOpportunityInputSchema.safeParse({
      ...base,
      deadlineKind: "rolling",
      deadlineDate: "",
      deadlineRawText: "Rolling admissions",
    });
    expect(result.success).toBe(true);
  });

  it("rejects a rolling deadline that also supplies a fixed date", () => {
    const result = customOpportunityInputSchema.safeParse({
      ...base,
      deadlineKind: "rolling",
      deadlineDate: "2027-03-01",
    });
    expect(result.success).toBe(false);
  });

  it("accepts an unknown deadline with no date", () => {
    const result = customOpportunityInputSchema.safeParse({
      ...base,
      deadlineKind: "unknown",
      deadlineDate: "",
      deadlineRawText: "Not announced",
    });
    expect(result.success).toBe(true);
  });

  it("accepts an estimated deadline with a proxy date", () => {
    const result = customOpportunityInputSchema.safeParse({
      ...base,
      deadlineKind: "estimated",
      deadlineDate: "2027-03-15",
      deadlineRawText: "Around mid-March",
    });
    expect(result.success).toBe(true);
  });
});
