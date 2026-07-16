import { z } from "zod";
import { APPLICATION_STAGE_OPTIONS } from "@/lib/storage/types";
import { isValidIsoDate } from "@/lib/deadlines/calendar-math";

const optionalTrimmed = z
  .string()
  .trim()
  .transform((value) => (value.length === 0 ? null : value))
  .nullable()
  .optional();

const stringArrayMax = (max: number) => z.array(z.string().trim().min(1)).max(max).default([]);

/** `/account` profile form — every field optional, deliberately minimal (see ADR-003). */
export const studentProfileInputSchema = z
  .object({
    displayName: optionalTrimmed,
    countryOrRegion: optionalTrimmed,
    currentStudyLevel: optionalTrimmed,
    intendedStudyLevel: optionalTrimmed,
    graduationYear: z.number().int().min(1900).max(2200).nullable().optional(),
    targetIntakeYear: z.number().int().min(1900).max(2200).nullable().optional(),
    targetIntakeTerm: optionalTrimmed,
    preferredCountries: stringArrayMax(30),
    preferredStudyLevels: stringArrayMax(20),
  })
  .strict();

export type StudentProfileInput = z.infer<typeof studentProfileInputSchema>;

export const applicationStageValueSchema = z.enum(APPLICATION_STAGE_OPTIONS);

/** Partial patch applied to one `user_opportunity_tracking` row. */
export const trackingPatchSchema = z
  .object({
    shortlisted: z.boolean().optional(),
    stage: applicationStageValueSchema.optional(),
    personalDeadline: z.string().nullable().optional(),
    priority: z.number().int().min(1).max(5).nullable().optional(),
    archived: z.boolean().optional(),
  })
  .strict();

export type TrackingPatch = z.infer<typeof trackingPatchSchema>;

export const workspaceTargetTypeSchema = z.enum(["built-in", "custom"]);

export const noteInputSchema = z
  .object({
    targetType: workspaceTargetTypeSchema,
    targetId: z.uuid(),
    noteText: z.string().max(20_000),
  })
  .strict();

export type NoteInput = z.infer<typeof noteInputSchema>;

export const checklistTaskInputSchema = z
  .object({
    targetType: workspaceTargetTypeSchema,
    targetId: z.uuid(),
    taskText: z.string().trim().min(1).max(500),
    sourceType: z.enum(["generic", "user-created", "imported"]).default("user-created"),
  })
  .strict();

export type ChecklistTaskInput = z.infer<typeof checklistTaskInputSchema>;

export const planningPreferencesInputSchema = z
  .object({
    expectedGraduationDate: z
      .string()
      .refine((value) => value === "" || isValidIsoDate(value), { message: "Enter a valid calendar date (YYYY-MM-DD)" })
      .nullable()
      .optional()
      .transform((value) => (value ? value : null)),
    targetIntakeYear: z.number().int().min(1900).max(2200).nullable().optional(),
    targetIntakeTerm: optionalTrimmed,
    preferredStudyLevels: stringArrayMax(20),
    preferredCountries: stringArrayMax(30),
  })
  .strict();

export type PlanningPreferencesInput = z.infer<typeof planningPreferencesInputSchema>;

export const displayPreferencesInputSchema = z
  .object({
    theme: z.enum(["system", "light", "dark"]).nullable().optional(),
    catalogueView: z.enum(["grid", "list"]).optional(),
  })
  .strict();

export type DisplayPreferencesInput = z.infer<typeof displayPreferencesInputSchema>;
