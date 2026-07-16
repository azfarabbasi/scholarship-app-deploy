import { z } from "zod";
import { buildCsv } from "./export";

export const OPPORTUNITY_CSV_COLUMNS = [
  "title",
  "summary",
  "opportunityTypeCode",
  "organisationName",
  "providerName",
  "countries",
  "studyLevels",
  "officialWebsiteUrl",
  "applicationUrl",
  "benefitSummary",
  "eligibilitySummary",
  "deadlinePrecision",
  "deadlineDate",
  "deadlineRawText",
  "sourceUrl",
  "sourceOrganisationName",
  "sourceLastCheckedAt",
] as const;

export type OpportunityCsvColumn = (typeof OPPORTUNITY_CSV_COLUMNS)[number];

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Must be YYYY-MM-DD");

export const opportunityCsvRowSchema = z
  .object({
    title: z.string().trim().min(1, "Title is required"),
    summary: z.string().trim().min(1, "Summary is required"),
    opportunityTypeCode: z.string().trim().min(1),
    organisationName: z.string().trim().min(1),
    providerName: z.string().trim().min(1),
    countries: z.string().trim().min(1, "At least one country is required (semicolon-separated)"),
    studyLevels: z.string().trim().min(1, "At least one study level is required (semicolon-separated)"),
    officialWebsiteUrl: z.string().trim().url().optional().or(z.literal("")),
    applicationUrl: z.string().trim().url().optional().or(z.literal("")),
    benefitSummary: z.string().trim().min(1),
    eligibilitySummary: z.string().trim().min(1),
    deadlinePrecision: z.enum(["exact", "estimated", "rolling", "unknown"]),
    deadlineDate: isoDate.optional().or(z.literal("")),
    deadlineRawText: z.string().trim().min(1),
    sourceUrl: z.string().trim().url("Must be a valid URL"),
    sourceOrganisationName: z.string().trim().min(1),
    sourceLastCheckedAt: isoDate.optional().or(z.literal("")),
  })
  .superRefine((row, ctx) => {
    if ((row.deadlinePrecision === "exact" || row.deadlinePrecision === "estimated") && !row.deadlineDate) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "deadlineDate is required for exact/estimated precision", path: ["deadlineDate"] });
    }
    if ((row.deadlinePrecision === "rolling" || row.deadlinePrecision === "unknown") && row.deadlineDate) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "deadlineDate must be empty for rolling/unknown precision", path: ["deadlineDate"] });
    }
  });

export type OpportunityCsvRow = z.infer<typeof opportunityCsvRowSchema>;

export function splitSemicolonList(value: string): string[] {
  return value
    .split(";")
    .map((v) => v.trim())
    .filter(Boolean);
}

export function buildOpportunityCsvTemplate(): string {
  const example: Record<OpportunityCsvColumn, string> = {
    title: "Example University Scholarship",
    summary: "One-paragraph public summary of the opportunity.",
    opportunityTypeCode: "scholarship",
    organisationName: "Example University",
    providerName: "Example University International Office",
    countries: "Germany;France",
    studyLevels: "Master;PhD",
    officialWebsiteUrl: "https://example.edu/scholarships",
    applicationUrl: "https://example.edu/scholarships/apply",
    benefitSummary: "Full tuition waiver plus a monthly stipend.",
    eligibilitySummary: "Open to applicants with an undergraduate degree in a related field.",
    deadlinePrecision: "exact",
    deadlineDate: "2027-03-15",
    deadlineRawText: "March 15, 2027",
    sourceUrl: "https://example.edu/scholarships",
    sourceOrganisationName: "Example University",
    sourceLastCheckedAt: "2027-01-10",
  };
  return buildCsv(
    OPPORTUNITY_CSV_COLUMNS,
    [OPPORTUNITY_CSV_COLUMNS.map((column) => example[column])],
  );
}
