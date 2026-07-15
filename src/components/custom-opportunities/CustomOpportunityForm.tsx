"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Checkbox, FieldError, Input, Label, Select, Textarea } from "@/components/ui/Field";
import { Alert } from "@/components/ui/Alert";
import { useLiveAnnouncer } from "@/components/common/LiveAnnouncer";
import { OPPORTUNITY_TYPES, type OpportunityTypeCode } from "@/lib/domain";
import {
  customOpportunityInputSchema,
  type CustomOpportunityInput,
} from "@/lib/schemas/custom-opportunity";
import { studyLevelSchema, type StudyLevel } from "@/lib/schemas/opportunity-seed";
import type { CustomOpportunityRecord } from "@/lib/storage/types";

const STUDY_LEVEL_OPTIONS = studyLevelSchema.options;
const OPPORTUNITY_TYPE_LABELS: Record<OpportunityTypeCode, string> = {
  scholarship: "Scholarship",
  "partial-scholarship": "Partial scholarship",
  internship: "Internship",
  fellowship: "Fellowship",
  exchange: "Exchange",
  "research-placement": "Research placement",
  grant: "Grant",
  competition: "Competition",
  conference: "Conference",
  "summer-school": "Summer school",
};

interface FormState {
  title: string;
  opportunityType: OpportunityTypeCode;
  providerName: string;
  countries: string;
  regions: string;
  studyLevels: StudyLevel[];
  benefitSummary: string;
  eligibilitySummary: string;
  officialUrl: string;
  deadlineKind: "exact" | "estimated" | "rolling" | "unknown";
  deadlineRawText: string;
  deadlineDate: string;
  deadlineTimezone: string;
  verificationNotes: string;
}

function toFormState(record?: CustomOpportunityRecord): FormState {
  return {
    title: record?.title ?? "",
    opportunityType: record?.opportunityType ?? "scholarship",
    providerName: record?.providerName ?? "",
    countries: record?.countries.join(", ") ?? "",
    regions: record?.regions.join(", ") ?? "",
    studyLevels: record?.studyLevels ?? [],
    benefitSummary: record?.benefitSummary ?? "",
    eligibilitySummary: record?.eligibilitySummary ?? "",
    officialUrl: record?.officialUrl ?? "",
    deadlineKind: record?.deadlineKind ?? "exact",
    deadlineRawText: record?.deadlineRawText ?? "",
    deadlineDate: record?.deadlineDate ?? "",
    deadlineTimezone: record?.deadlineTimezone ?? "",
    verificationNotes: record?.verificationNotes ?? "",
  };
}

function splitList(value: string): string[] {
  return value
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
}

export interface CustomOpportunityFormProps {
  initialRecord?: CustomOpportunityRecord;
  submitLabel: string;
  onSubmit: (input: CustomOpportunityInput) => Promise<{ slug: string }>;
}

export function CustomOpportunityForm({ initialRecord, submitLabel, onSubmit }: CustomOpportunityFormProps) {
  const [form, setForm] = useState<FormState>(() => toFormState(initialRecord));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const router = useRouter();
  const { announce } = useLiveAnnouncer();

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSubmitError(null);

    const candidate = {
      title: form.title,
      opportunityType: form.opportunityType,
      providerName: form.providerName,
      countries: splitList(form.countries),
      regions: splitList(form.regions),
      studyLevels: form.studyLevels,
      benefitSummary: form.benefitSummary,
      eligibilitySummary: form.eligibilitySummary,
      officialUrl: form.officialUrl,
      deadlineKind: form.deadlineKind,
      deadlineRawText: form.deadlineRawText,
      deadlineDate: form.deadlineDate,
      deadlineTimezone: form.deadlineTimezone,
      verificationNotes: form.verificationNotes,
    };

    const result = customOpportunityInputSchema.safeParse(candidate);
    if (!result.success) {
      const nextErrors: Record<string, string> = {};
      for (const issue of result.error.issues) {
        const path = issue.path[0]?.toString() ?? "form";
        if (!nextErrors[path]) {
          nextErrors[path] = issue.message;
        }
      }
      setErrors(nextErrors);
      announce("The form has errors. Review the highlighted fields.");
      return;
    }

    setErrors({});
    setSubmitting(true);
    try {
      const { slug } = await onSubmit(result.data);
      announce(`${result.data.title} saved.`);
      router.push(`/opportunities/${slug}`);
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "Could not save this opportunity.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-6">
      {submitError ? <Alert tone="danger" title="Could not save">{submitError}</Alert> : null}

      <div>
        <Label htmlFor="co-title">Title</Label>
        <Input
          id="co-title"
          value={form.title}
          onChange={(e) => update("title", e.target.value)}
          invalid={Boolean(errors.title)}
          aria-describedby={errors.title ? "co-title-error" : undefined}
          required
        />
        {errors.title ? <FieldError id="co-title-error">{errors.title}</FieldError> : null}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="co-type">Opportunity type</Label>
          <Select
            id="co-type"
            value={form.opportunityType}
            onChange={(e) => update("opportunityType", e.target.value as OpportunityTypeCode)}
          >
            {OPPORTUNITY_TYPES.map((type) => (
              <option key={type} value={type}>
                {OPPORTUNITY_TYPE_LABELS[type]}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor="co-provider">Provider (optional)</Label>
          <Input id="co-provider" value={form.providerName} onChange={(e) => update("providerName", e.target.value)} />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="co-countries">Countries (comma-separated)</Label>
          <Input
            id="co-countries"
            value={form.countries}
            onChange={(e) => update("countries", e.target.value)}
            invalid={Boolean(errors.countries)}
            placeholder="e.g. Germany, France"
          />
          {errors.countries ? <FieldError>{errors.countries}</FieldError> : null}
        </div>
        <div>
          <Label htmlFor="co-regions">Regions (comma-separated)</Label>
          <Input
            id="co-regions"
            value={form.regions}
            onChange={(e) => update("regions", e.target.value)}
            placeholder="e.g. EU-wide"
          />
        </div>
      </div>

      <fieldset>
        <legend className="text-sm font-medium text-foreground">Study levels</legend>
        <div className="mt-2 flex flex-wrap gap-3">
          {STUDY_LEVEL_OPTIONS.map((level) => (
            <Checkbox
              key={level}
              id={`co-level-${level}`}
              label={level}
              checked={form.studyLevels.includes(level)}
              onChange={() =>
                update(
                  "studyLevels",
                  form.studyLevels.includes(level)
                    ? form.studyLevels.filter((l) => l !== level)
                    : [...form.studyLevels, level],
                )
              }
            />
          ))}
        </div>
        {errors.studyLevels ? <FieldError>{errors.studyLevels}</FieldError> : null}
      </fieldset>

      <div>
        <Label htmlFor="co-benefit">Benefit / funding summary</Label>
        <Textarea
          id="co-benefit"
          value={form.benefitSummary}
          onChange={(e) => update("benefitSummary", e.target.value)}
          invalid={Boolean(errors.benefitSummary)}
          required
        />
        {errors.benefitSummary ? <FieldError>{errors.benefitSummary}</FieldError> : null}
      </div>

      <div>
        <Label htmlFor="co-eligibility">Eligibility summary</Label>
        <Textarea
          id="co-eligibility"
          value={form.eligibilitySummary}
          onChange={(e) => update("eligibilitySummary", e.target.value)}
          invalid={Boolean(errors.eligibilitySummary)}
          required
        />
        {errors.eligibilitySummary ? <FieldError>{errors.eligibilitySummary}</FieldError> : null}
      </div>

      <div>
        <Label htmlFor="co-url">Official URL (optional)</Label>
        <Input
          id="co-url"
          type="url"
          value={form.officialUrl}
          onChange={(e) => update("officialUrl", e.target.value)}
          invalid={Boolean(errors.officialUrl)}
          placeholder="https://example.com"
        />
        {errors.officialUrl ? <FieldError>{errors.officialUrl}</FieldError> : null}
      </div>

      <div className="rounded-lg border border-border p-4">
        <h2 className="text-sm font-semibold text-foreground">Deadline</h2>
        <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="co-deadline-kind">Deadline type</Label>
            <Select
              id="co-deadline-kind"
              value={form.deadlineKind}
              onChange={(e) => update("deadlineKind", e.target.value as FormState["deadlineKind"])}
            >
              <option value="exact">Exact date</option>
              <option value="estimated">Estimated</option>
              <option value="rolling">Rolling</option>
              <option value="unknown">Unknown</option>
            </Select>
          </div>
          {form.deadlineKind === "exact" || form.deadlineKind === "estimated" ? (
            <div>
              <Label htmlFor="co-deadline-date">Calendar date</Label>
              <Input
                id="co-deadline-date"
                type="date"
                value={form.deadlineDate}
                onChange={(e) => update("deadlineDate", e.target.value)}
                invalid={Boolean(errors.deadlineDate)}
              />
              {errors.deadlineDate ? <FieldError>{errors.deadlineDate}</FieldError> : null}
            </div>
          ) : null}
        </div>

        <div className="mt-4">
          <Label htmlFor="co-deadline-text">Original deadline wording</Label>
          <Input
            id="co-deadline-text"
            value={form.deadlineRawText}
            onChange={(e) => update("deadlineRawText", e.target.value)}
            invalid={Boolean(errors.deadlineRawText)}
            placeholder="e.g. Rolling admissions, usually closes in March"
            required
          />
          {errors.deadlineRawText ? <FieldError>{errors.deadlineRawText}</FieldError> : null}
        </div>

        <div className="mt-4">
          <Label htmlFor="co-deadline-tz">Timezone (optional)</Label>
          <Input
            id="co-deadline-tz"
            value={form.deadlineTimezone}
            onChange={(e) => update("deadlineTimezone", e.target.value)}
            placeholder="e.g. Europe/Berlin"
          />
        </div>
      </div>

      <div>
        <Label htmlFor="co-verification-notes">Verification notes (optional)</Label>
        <Textarea
          id="co-verification-notes"
          value={form.verificationNotes}
          onChange={(e) => update("verificationNotes", e.target.value)}
          placeholder="Where did you find this information? Has it been checked recently?"
        />
        <p className="mt-1 text-xs text-foreground-subtle">
          Custom opportunities are your own entries and are never labelled as officially verified.
        </p>
      </div>

      <div className="flex justify-end gap-2">
        <Button type="submit" disabled={submitting}>
          {submitting ? "Saving…" : submitLabel}
        </Button>
      </div>
    </form>
  );
}
