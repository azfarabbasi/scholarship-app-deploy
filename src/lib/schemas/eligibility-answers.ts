import { z } from "zod";

/**
 * The optional eligibility questionnaire (Checkpoint 4). Every field is
 * optional/nullable by design: matching degrades gracefully to
 * "missing information" rather than requiring anything.
 *
 * Deliberately NOT collected (and rejected by the strict schema): passport
 * or ID numbers, full address, financial documents, medical data,
 * religious/ethnic identity, transcript/CV/letter files or their contents.
 * Nationality and residence are collected only as free-text country names,
 * only if the user chooses, because official eligibility rules frequently
 * key on them — the UI marks both optional and explains why they help.
 */

const optionalTrimmed = z
  .string()
  .trim()
  .max(120)
  .transform((value) => (value.length === 0 ? null : value))
  .nullable()
  .optional();

const stringArrayMax = (max: number) => z.array(z.string().trim().min(1).max(120)).max(max).default([]);

export const LANGUAGE_TEST_STATUS_OPTIONS = ["have-valid-result", "booked", "planned", "none"] as const;
export const YES_NO_UNKNOWN_OPTIONS = ["yes", "no", "unknown"] as const;
export const FUNDING_PREFERENCE_OPTIONS = ["fully-funded-only", "partial-ok", "any"] as const;
export const STUDY_MODE_OPTIONS = ["on-campus", "remote", "either"] as const;

export const eligibilityAnswersSchema = z
  .object({
    countryOfResidence: optionalTrimmed,
    nationality: optionalTrimmed,
    currentStudyLevel: optionalTrimmed,
    intendedStudyLevel: optionalTrimmed,
    fieldsOfInterest: stringArrayMax(20),
    graduationYear: z.number().int().min(1950).max(2100).nullable().optional(),
    targetIntakeYear: z.number().int().min(1950).max(2100).nullable().optional(),
    targetIntakeTerm: optionalTrimmed,
    preferredCountries: stringArrayMax(30),
    preferredRegions: stringArrayMax(20),
    languageTestStatus: z.enum(LANGUAGE_TEST_STATUS_OPTIONS).nullable().optional(),
    researchExperience: z.enum(YES_NO_UNKNOWN_OPTIONS).nullable().optional(),
    workExperienceYears: z.number().int().min(0).max(60).nullable().optional(),
    finalYearStatus: z.enum(YES_NO_UNKNOWN_OPTIONS).nullable().optional(),
    fundingPreference: z.enum(FUNDING_PREFERENCE_OPTIONS).nullable().optional(),
    studyMode: z.enum(STUDY_MODE_OPTIONS).nullable().optional(),
  })
  .strict();

export type EligibilityAnswersInput = z.infer<typeof eligibilityAnswersSchema>;

/** The fully-resolved answers shape (every field present, defaulted to null/[]). */
export interface EligibilityAnswers {
  countryOfResidence: string | null;
  nationality: string | null;
  currentStudyLevel: string | null;
  intendedStudyLevel: string | null;
  fieldsOfInterest: string[];
  graduationYear: number | null;
  targetIntakeYear: number | null;
  targetIntakeTerm: string | null;
  preferredCountries: string[];
  preferredRegions: string[];
  languageTestStatus: (typeof LANGUAGE_TEST_STATUS_OPTIONS)[number] | null;
  researchExperience: (typeof YES_NO_UNKNOWN_OPTIONS)[number] | null;
  workExperienceYears: number | null;
  finalYearStatus: (typeof YES_NO_UNKNOWN_OPTIONS)[number] | null;
  fundingPreference: (typeof FUNDING_PREFERENCE_OPTIONS)[number] | null;
  studyMode: (typeof STUDY_MODE_OPTIONS)[number] | null;
}

export const EMPTY_ELIGIBILITY_ANSWERS: EligibilityAnswers = {
  countryOfResidence: null,
  nationality: null,
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
};

export function resolveAnswers(input: EligibilityAnswersInput | null | undefined): EligibilityAnswers {
  if (!input) return EMPTY_ELIGIBILITY_ANSWERS;
  return { ...EMPTY_ELIGIBILITY_ANSWERS, ...Object.fromEntries(Object.entries(input).filter(([, v]) => v !== undefined)) };
}

/** True when the user hasn't answered anything yet — matching reports "missing information" prompts. */
export function answersAreEmpty(answers: EligibilityAnswers): boolean {
  return (
    !answers.countryOfResidence &&
    !answers.nationality &&
    !answers.currentStudyLevel &&
    !answers.intendedStudyLevel &&
    answers.fieldsOfInterest.length === 0 &&
    answers.graduationYear === null &&
    answers.targetIntakeYear === null &&
    !answers.targetIntakeTerm &&
    answers.preferredCountries.length === 0 &&
    answers.preferredRegions.length === 0 &&
    !answers.languageTestStatus &&
    !answers.researchExperience &&
    answers.workExperienceYears === null &&
    !answers.finalYearStatus &&
    !answers.fundingPreference &&
    !answers.studyMode
  );
}
