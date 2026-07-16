import { z } from "zod";

export const CORRECTION_CATEGORIES = [
  "incorrect-deadline",
  "broken-official-link",
  "incorrect-eligibility",
  "incorrect-funding-information",
  "missing-or-incorrect-document-requirement",
  "duplicate-record",
  "closed-programme",
  "other",
] as const;

export const CORRECTION_CATEGORY_LABELS: Record<(typeof CORRECTION_CATEGORIES)[number], string> = {
  "incorrect-deadline": "Incorrect deadline",
  "broken-official-link": "Broken official link",
  "incorrect-eligibility": "Incorrect eligibility information",
  "incorrect-funding-information": "Incorrect funding information",
  "missing-or-incorrect-document-requirement": "Missing or incorrect document requirement",
  "duplicate-record": "This looks like a duplicate record",
  "closed-programme": "This programme appears to be closed",
  other: "Other",
};

/**
 * Deliberately collects nothing beyond what's needed to triage a catalogue
 * correction — no application documents, passwords, or other personal data.
 * `honeypot` must stay empty; a filled value is a low-cost spam signal (a
 * real visitor never sees or fills this field).
 */
export const correctionReportInputSchema = z.object({
  opportunityId: z.string().uuid(),
  category: z.enum(CORRECTION_CATEGORIES),
  description: z
    .string()
    .trim()
    .min(10, "Please provide a few more details (at least 10 characters).")
    .max(2000, "Please keep this under 2000 characters."),
  suggestedOfficialSourceUrl: z
    .string()
    .trim()
    .url("Must be a valid URL")
    .max(2048)
    .optional()
    .or(z.literal("").transform(() => undefined)),
  reporterContactEmail: z
    .string()
    .trim()
    .email("Must be a valid email address")
    .max(320)
    .optional()
    .or(z.literal("").transform(() => undefined)),
  honeypot: z.string().max(0, "Spam check failed.").optional().or(z.literal("")),
});

export type CorrectionReportInput = z.infer<typeof correctionReportInputSchema>;
