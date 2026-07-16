"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";
import { FieldError, Input, Label, Select, Textarea } from "@/components/ui/Field";
import { OPPORTUNITY_TYPES, type OpportunityTypeCode } from "@/lib/domain";
import type { CustomOpportunityInput } from "@/lib/schemas/custom-opportunity";

interface CloudCustomOpportunityQuickAddProps {
  onCreate: (input: CustomOpportunityInput) => Promise<{ ok: boolean; error?: string }>;
}

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

/**
 * A compact cloud-only custom-opportunity creation form — deliberately
 * simpler than `CustomOpportunityForm` (the guest version), which navigates
 * to `/opportunities/[slug]` on success, a route that only ever resolves
 * guest custom opportunities and the public database catalogue. Building an
 * equivalent public detail route for cloud custom opportunities is
 * documented as follow-up work (see
 * `docs/checkpoint-3/checkpoint-3-completion-report.md`); this form instead
 * creates in place and refreshes the list.
 */
export function CloudCustomOpportunityQuickAdd({ onCreate }: CloudCustomOpportunityQuickAddProps) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [opportunityType, setOpportunityType] = useState<OpportunityTypeCode>("scholarship");
  const [countries, setCountries] = useState("");
  const [benefitSummary, setBenefitSummary] = useState("");
  const [eligibilitySummary, setEligibilitySummary] = useState("");
  const [deadlineRawText, setDeadlineRawText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (!open) {
    return (
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
        Add a custom opportunity
      </Button>
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const result = await onCreate({
      title,
      opportunityType,
      providerName: null,
      countries: countries
        .split(",")
        .map((c) => c.trim())
        .filter(Boolean),
      regions: [],
      studyLevels: ["Bachelor"],
      benefitSummary,
      eligibilitySummary,
      officialUrl: null,
      deadlineKind: "unknown",
      deadlineRawText,
      deadlineDate: null,
      deadlineTimezone: null,
      verificationNotes: null,
    });

    setSubmitting(false);
    if (!result.ok) {
      setError(result.error ?? "Could not create this custom opportunity.");
      return;
    }
    setOpen(false);
    setTitle("");
    setCountries("");
    setBenefitSummary("");
    setEligibilitySummary("");
    setDeadlineRawText("");
  }

  return (
    <form className="flex flex-col gap-3 rounded-lg border border-border p-4" onSubmit={handleSubmit}>
      {error ? <Alert tone="danger">{error}</Alert> : null}
      <div>
        <Label htmlFor="quick-add-title">Title</Label>
        <Input id="quick-add-title" required value={title} onChange={(e) => setTitle(e.target.value)} />
      </div>
      <div>
        <Label htmlFor="quick-add-type">Type</Label>
        <Select id="quick-add-type" value={opportunityType} onChange={(e) => setOpportunityType(e.target.value as OpportunityTypeCode)}>
          {OPPORTUNITY_TYPES.map((type) => (
            <option key={type} value={type}>
              {OPPORTUNITY_TYPE_LABELS[type]}
            </option>
          ))}
        </Select>
      </div>
      <div>
        <Label htmlFor="quick-add-countries">Countries/regions</Label>
        <Input id="quick-add-countries" value={countries} onChange={(e) => setCountries(e.target.value)} placeholder="Germany, ..." />
      </div>
      <div>
        <Label htmlFor="quick-add-benefit">Benefit summary</Label>
        <Textarea id="quick-add-benefit" required value={benefitSummary} onChange={(e) => setBenefitSummary(e.target.value)} />
      </div>
      <div>
        <Label htmlFor="quick-add-eligibility">Eligibility summary</Label>
        <Textarea id="quick-add-eligibility" required value={eligibilitySummary} onChange={(e) => setEligibilitySummary(e.target.value)} />
      </div>
      <div>
        <Label htmlFor="quick-add-deadline">Deadline (as written on the official source)</Label>
        <Input id="quick-add-deadline" required value={deadlineRawText} onChange={(e) => setDeadlineRawText(e.target.value)} />
      </div>
      {countries.trim().length === 0 ? <FieldError>Enter at least one country or region.</FieldError> : null}
      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={submitting || countries.trim().length === 0}>
          {submitting ? "Saving…" : "Save"}
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
