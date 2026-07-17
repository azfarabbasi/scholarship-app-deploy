import { describe, expect, it } from "vitest";
import {
  EMPTY_ELIGIBILITY_ANSWERS,
  answersAreEmpty,
  eligibilityAnswersSchema,
  resolveAnswers,
  type EligibilityAnswersInput,
} from "@/lib/schemas/eligibility-answers";

describe("eligibilityAnswersSchema", () => {
  it("accepts a fully empty object — every field is optional", () => {
    const result = eligibilityAnswersSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it("accepts a fully populated, valid answer set", () => {
    const input = {
      countryOfResidence: "Germany",
      nationality: "Germany",
      currentStudyLevel: "Bachelor",
      intendedStudyLevel: "Master",
      fieldsOfInterest: ["Computer Science", "Physics"],
      graduationYear: 2026,
      targetIntakeYear: 2027,
      targetIntakeTerm: "Fall",
      preferredCountries: ["Germany", "France"],
      preferredRegions: ["Europe"],
      languageTestStatus: "have-valid-result",
      researchExperience: "yes",
      workExperienceYears: 2,
      finalYearStatus: "yes",
      fundingPreference: "fully-funded-only",
      studyMode: "on-campus",
    };
    const result = eligibilityAnswersSchema.safeParse(input);
    expect(result.success).toBe(true);
  });

  it("rejects any key outside the defined shape (strict schema)", () => {
    const result = eligibilityAnswersSchema.safeParse({ passportNumber: "X1234567" });
    expect(result.success).toBe(false);
  });

  it.each(["passportNumber", "idNumber", "address", "bankAccount", "religion", "ethnicity", "transcriptFileId", "cvFileId", "recommendationLetterText"])(
    "rejects the deliberately-excluded field '%s'",
    (field) => {
      const result = eligibilityAnswersSchema.safeParse({ [field]: "anything" });
      expect(result.success).toBe(false);
    },
  );

  it("normalises a blank/whitespace-only optional string to null", () => {
    const result = eligibilityAnswersSchema.safeParse({ countryOfResidence: "   " });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.countryOfResidence).toBeNull();
    }
  });

  it("trims a valid optional string", () => {
    const result = eligibilityAnswersSchema.safeParse({ nationality: "  Germany  " });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.nationality).toBe("Germany");
    }
  });

  it("rejects an out-of-range graduation year", () => {
    expect(eligibilityAnswersSchema.safeParse({ graduationYear: 1900 }).success).toBe(false);
    expect(eligibilityAnswersSchema.safeParse({ graduationYear: 2200 }).success).toBe(false);
  });

  it("rejects a value outside the enumerated options", () => {
    expect(eligibilityAnswersSchema.safeParse({ languageTestStatus: "fluent" }).success).toBe(false);
    expect(eligibilityAnswersSchema.safeParse({ fundingPreference: "scholarship-only" }).success).toBe(false);
    expect(eligibilityAnswersSchema.safeParse({ studyMode: "hybrid" }).success).toBe(false);
  });

  it("caps fieldsOfInterest/preferredCountries/preferredRegions at their max length", () => {
    const tooManyFields = Array.from({ length: 21 }, (_, i) => `field-${i}`);
    expect(eligibilityAnswersSchema.safeParse({ fieldsOfInterest: tooManyFields }).success).toBe(false);
    const tooManyCountries = Array.from({ length: 31 }, (_, i) => `country-${i}`);
    expect(eligibilityAnswersSchema.safeParse({ preferredCountries: tooManyCountries }).success).toBe(false);
  });

  it("rejects a negative work-experience year count", () => {
    expect(eligibilityAnswersSchema.safeParse({ workExperienceYears: -1 }).success).toBe(false);
  });
});

describe("resolveAnswers", () => {
  it("returns the empty defaults for null/undefined input", () => {
    expect(resolveAnswers(null)).toEqual(EMPTY_ELIGIBILITY_ANSWERS);
    expect(resolveAnswers(undefined)).toEqual(EMPTY_ELIGIBILITY_ANSWERS);
  });

  it("fills in defaults for any field the input omits", () => {
    const input: EligibilityAnswersInput = { nationality: "Germany", fieldsOfInterest: [], preferredCountries: [], preferredRegions: [] };
    const resolved = resolveAnswers(input);
    expect(resolved.nationality).toBe("Germany");
    expect(resolved.countryOfResidence).toBeNull();
    expect(resolved.fieldsOfInterest).toEqual([]);
  });

  it("never lets an explicit undefined value override a default", () => {
    const input = { nationality: undefined, fieldsOfInterest: [], preferredCountries: [], preferredRegions: [] } as EligibilityAnswersInput;
    const resolved = resolveAnswers(input);
    expect(resolved.nationality).toBeNull();
  });
});

describe("answersAreEmpty", () => {
  it("is true for the empty defaults", () => {
    expect(answersAreEmpty(EMPTY_ELIGIBILITY_ANSWERS)).toBe(true);
  });

  it("is false once any single field is set", () => {
    expect(answersAreEmpty({ ...EMPTY_ELIGIBILITY_ANSWERS, nationality: "Germany" })).toBe(false);
    expect(answersAreEmpty({ ...EMPTY_ELIGIBILITY_ANSWERS, fieldsOfInterest: ["Physics"] })).toBe(false);
    expect(answersAreEmpty({ ...EMPTY_ELIGIBILITY_ANSWERS, workExperienceYears: 0 })).toBe(false);
  });
});
