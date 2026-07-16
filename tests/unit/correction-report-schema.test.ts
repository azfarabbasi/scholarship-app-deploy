import { describe, expect, it } from "vitest";
import { correctionReportInputSchema } from "@/lib/schemas/correction-report";

const validInput = {
  opportunityId: "123e4567-e89b-42d3-a456-426614174000",
  category: "incorrect-deadline",
  description: "The deadline listed here passed six months ago according to the official site.",
};

describe("correctionReportInputSchema", () => {
  it("accepts a minimal valid report", () => {
    expect(correctionReportInputSchema.safeParse(validInput).success).toBe(true);
  });

  it("rejects a non-UUID opportunityId", () => {
    expect(correctionReportInputSchema.safeParse({ ...validInput, opportunityId: "not-a-uuid" }).success).toBe(false);
  });

  it("rejects an unknown category", () => {
    expect(correctionReportInputSchema.safeParse({ ...validInput, category: "made-up-category" }).success).toBe(false);
  });

  it("rejects a description that is too short", () => {
    expect(correctionReportInputSchema.safeParse({ ...validInput, description: "short" }).success).toBe(false);
  });

  it("rejects a description longer than 2000 characters", () => {
    expect(correctionReportInputSchema.safeParse({ ...validInput, description: "x".repeat(2001) }).success).toBe(false);
  });

  it("rejects an invalid suggested source URL but accepts an empty string", () => {
    expect(correctionReportInputSchema.safeParse({ ...validInput, suggestedOfficialSourceUrl: "not a url" }).success).toBe(false);
    expect(correctionReportInputSchema.safeParse({ ...validInput, suggestedOfficialSourceUrl: "" }).success).toBe(true);
  });

  it("rejects an invalid reporter email but accepts an empty string", () => {
    expect(correctionReportInputSchema.safeParse({ ...validInput, reporterContactEmail: "not-an-email" }).success).toBe(false);
    expect(correctionReportInputSchema.safeParse({ ...validInput, reporterContactEmail: "" }).success).toBe(true);
  });

  it("rejects a non-empty honeypot value", () => {
    const result = correctionReportInputSchema.safeParse({ ...validInput, honeypot: "I am a bot" });
    expect(result.success).toBe(false);
  });

  it("accepts a fully populated, legitimate report", () => {
    const result = correctionReportInputSchema.safeParse({
      ...validInput,
      suggestedOfficialSourceUrl: "https://example.edu/scholarships",
      reporterContactEmail: "student@example.com",
      honeypot: "",
    });
    expect(result.success).toBe(true);
  });
});
