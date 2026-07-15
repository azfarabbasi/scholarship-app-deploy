import { z } from "zod";
import { OPPORTUNITY_TYPES } from "@/lib/domain";
import { isValidIsoDate } from "@/lib/deadlines/calendar-math";
import { studyLevelSchema } from "./opportunity-seed";

const trimmedNonEmpty = z.string().trim().min(1, "This field is required");
const optionalTrimmed = z
  .string()
  .trim()
  .transform((value) => (value.length === 0 ? null : value))
  .nullable()
  .optional();

export const customDeadlineKindSchema = z.enum(["exact", "estimated", "rolling", "unknown"]);

export const customOpportunityInputSchema = z
  .object({
    title: trimmedNonEmpty.max(200),
    opportunityType: z.enum(OPPORTUNITY_TYPES),
    providerName: optionalTrimmed,
    countries: z.array(trimmedNonEmpty).max(20).default([]),
    regions: z.array(trimmedNonEmpty).max(20).default([]),
    studyLevels: z.array(studyLevelSchema).min(1, "Select at least one study level"),
    benefitSummary: trimmedNonEmpty.max(2000),
    eligibilitySummary: trimmedNonEmpty.max(2000),
    officialUrl: z
      .union([z.string().trim().url("Enter a valid URL, e.g. https://example.com"), z.literal("")])
      .optional()
      .transform((value) => (value ? value : null)),
    deadlineKind: customDeadlineKindSchema,
    deadlineRawText: trimmedNonEmpty.max(300),
    deadlineDate: z
      .string()
      .trim()
      .refine((value) => value === "" || isValidIsoDate(value), {
        message: "Enter a valid calendar date (YYYY-MM-DD)",
      })
      .optional()
      .transform((value) => (value ? value : null)),
    deadlineTimezone: optionalTrimmed,
    verificationNotes: optionalTrimmed,
  })
  .superRefine((value, ctx) => {
    if (value.countries.length === 0 && value.regions.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Enter at least one country or region",
        path: ["countries"],
      });
    }

    if (value.deadlineKind === "exact" && !value.deadlineDate) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "An exact deadline requires a calendar date",
        path: ["deadlineDate"],
      });
    }

    if (value.deadlineKind === "rolling" && value.deadlineDate) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Rolling deadlines must not include a fixed calendar date",
        path: ["deadlineDate"],
      });
    }

    if (value.deadlineKind === "unknown" && value.deadlineDate) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Unknown deadlines must not include a fixed calendar date",
        path: ["deadlineDate"],
      });
    }
  });

export type CustomOpportunityInput = z.infer<typeof customOpportunityInputSchema>;
