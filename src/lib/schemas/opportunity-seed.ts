import { z } from "zod";

const trimmedNonEmptyStringSchema = z
  .string()
  .min(1, "Must not be empty")
  .refine((value) => value === value.trim(), {
    message: "Must not contain leading or trailing whitespace",
  });

const strictIsoDatePattern = /^(\d{4})-(\d{2})-(\d{2})$/;

function isStrictIsoCalendarDate(value: string): boolean {
  const match = strictIsoDatePattern.exec(value);

  if (!match) {
    return false;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);

  if (year < 1 || month < 1 || month > 12 || day < 1) {
    return false;
  }

  const isLeapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const daysInMonth = [
    31,
    isLeapYear ? 29 : 28,
    31,
    30,
    31,
    30,
    31,
    31,
    30,
    31,
    30,
    31,
  ];

  return day <= daysInMonth[month - 1];
}

function addDuplicateIssues<T extends string>(
  values: T[],
  pathPrefix: string,
  ctx: z.RefinementCtx,
): void {
  const firstIndexByValue = new Map<T, number>();

  values.forEach((value, index) => {
    const firstIndex = firstIndexByValue.get(value);

    if (firstIndex === undefined) {
      firstIndexByValue.set(value, index);
      return;
    }

    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: `Duplicate value; first used at index ${firstIndex}`,
      path: [pathPrefix, index],
    });
  });
}

export const studyLevelSchema = z.enum([
  "Bachelor",
  "Master",
  "PhD",
  "Postdoc",
  "Research",
  "Exchange",
]);

export const deadlinePrecisionSchema = z.enum([
  "exact",
  "estimated",
  "rolling",
  "unknown",
]);

export const verificationStatusSchema = z.enum([
  "not-reverified",
  "needs-review",
  "verified",
]);

export const isoCalendarDateSchema = z
  .string()
  .refine(isStrictIsoCalendarDate, {
    message: "Must be a valid calendar date in strict YYYY-MM-DD format",
  });

export const deadlineSchema = z
  .object({
    rawText: trimmedNonEmptyStringSchema,
    precision: deadlinePrecisionSchema,
    dates: z.array(isoCalendarDateSchema),
    cycleYear: z.number().int().positive().nullable(),
    timezone: trimmedNonEmptyStringSchema.nullable(),
    isRolling: z.boolean(),
  })
  .strict()
  .superRefine((deadline, ctx) => {
    addDuplicateIssues(deadline.dates, "dates", ctx);

    if (deadline.precision === "rolling") {
      if (!deadline.isRolling) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Rolling deadlines must set isRolling to true",
          path: ["isRolling"],
        });
      }

      if (deadline.dates.length > 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Rolling deadlines must not contain closing dates",
          path: ["dates"],
        });
      }

      if (deadline.cycleYear !== null) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Rolling deadlines must have a null cycleYear",
          path: ["cycleYear"],
        });
      }

      return;
    }

    if (deadline.precision === "unknown") {
      if (deadline.isRolling) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Unknown deadlines must set isRolling to false",
          path: ["isRolling"],
        });
      }

      if (deadline.dates.length > 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Unknown deadlines must not contain dates",
          path: ["dates"],
        });
      }

      if (deadline.cycleYear !== null) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Unknown deadlines must have a null cycleYear",
          path: ["cycleYear"],
        });
      }

      return;
    }

    if (deadline.isRolling) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Exact and estimated deadlines must set isRolling to false",
        path: ["isRolling"],
      });
    }

    if (deadline.dates.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Exact and estimated deadlines require at least one date",
        path: ["dates"],
      });
    }

    if (deadline.cycleYear === null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Exact and estimated deadlines require a cycleYear",
        path: ["cycleYear"],
      });
      return;
    }

    deadline.dates.forEach((date, index) => {
      const dateYear = Number(date.slice(0, 4));

      if (dateYear !== deadline.cycleYear) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Date year ${dateYear} does not match cycleYear ${deadline.cycleYear}`,
          path: ["dates", index],
        });
      }
    });
  });

export const opportunitySourceSchema = z
  .object({
    sourceType: z.literal("legacy-prototype"),
    sourceReference: trimmedNonEmptyStringSchema,
    verificationStatus: verificationStatusSchema,
    lastCheckedAt: z.string().datetime({ offset: true }).nullable(),
  })
  .strict()
  .superRefine((source, ctx) => {
    if (
      source.verificationStatus === "not-reverified" &&
      source.lastCheckedAt !== null
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "A not-reverified source must have a null lastCheckedAt",
        path: ["lastCheckedAt"],
      });
    }

    if (
      source.verificationStatus === "verified" &&
      source.lastCheckedAt === null
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "A verified source must include lastCheckedAt",
        path: ["lastCheckedAt"],
      });
    }
  });

export const opportunitySeedSchema = z
  .object({
    legacyId: z.number().int().positive(),
    slug: z
      .string()
      .min(1, "Slug must not be empty")
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
        message: "Slug must contain only lowercase ASCII letters, digits, and single hyphens",
      }),
    title: trimmedNonEmptyStringSchema,
    opportunityType: z.literal("scholarship"),
    providerName: trimmedNonEmptyStringSchema.nullable(),
    countries: z.array(trimmedNonEmptyStringSchema),
    regions: z.array(trimmedNonEmptyStringSchema),
    studyLevels: z
      .array(studyLevelSchema)
      .min(1, "At least one study level is required"),
    benefitSummary: trimmedNonEmptyStringSchema,
    eligibilitySummary: trimmedNonEmptyStringSchema,
    deadline: deadlineSchema,
    officialUrl: z
      .string()
      .url("Must be a valid URL")
      .refine((value) => /^https?:\/\//i.test(value), {
        message: "Official URL must use http or https",
      }),
    source: opportunitySourceSchema,
    migrationNotes: z.array(trimmedNonEmptyStringSchema),
  })
  .strict()
  .superRefine((opportunity, ctx) => {
    addDuplicateIssues(opportunity.studyLevels, "studyLevels", ctx);

    if (opportunity.countries.length === 0 && opportunity.regions.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "At least one country or region is required",
        path: ["countries"],
      });
    }
  });

export const opportunitySeedDatasetSchema = z.array(opportunitySeedSchema);

export type StudyLevel = z.infer<typeof studyLevelSchema>;
export type DeadlinePrecision = z.infer<typeof deadlinePrecisionSchema>;
export type VerificationStatus = z.infer<typeof verificationStatusSchema>;
export type OpportunityDeadline = z.infer<typeof deadlineSchema>;
export type OpportunitySource = z.infer<typeof opportunitySourceSchema>;
export type OpportunitySeed = z.infer<typeof opportunitySeedSchema>;
export type OpportunitySeedDataset = z.infer<typeof opportunitySeedDatasetSchema>;
