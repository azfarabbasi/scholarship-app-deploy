"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { HelpText, Input, Label, Select, Textarea } from "@/components/ui/Field";
import type { OptionRow } from "@/lib/db/reference-data";
import type { ActionResult, CreateOpportunityInput } from "@/lib/db/actions/opportunities";

interface OpportunityFormProps {
  opportunityTypes: OptionRow[];
  providers: OptionRow[];
  initial?: Partial<CreateOpportunityInput>;
  requireChangeReason?: boolean;
  submitLabel: string;
  onSubmit: (input: CreateOpportunityInput & { changeReason?: string }) => Promise<ActionResult>;
}

export function OpportunityForm({
  opportunityTypes,
  providers,
  initial,
  requireChangeReason,
  submitLabel,
  onSubmit,
}: OpportunityFormProps) {
  const router = useRouter();
  const [title, setTitle] = useState(initial?.title ?? "");
  const [summary, setSummary] = useState(initial?.summary ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [opportunityTypeId, setOpportunityTypeId] = useState(initial?.opportunityTypeId ?? opportunityTypes[0]?.id ?? "");
  const [providerId, setProviderId] = useState(initial?.providerId ?? providers[0]?.id ?? "");
  const [applicationUrl, setApplicationUrl] = useState(initial?.applicationUrl ?? "");
  const [officialWebsiteUrl, setOfficialWebsiteUrl] = useState(initial?.officialWebsiteUrl ?? "");
  const [changeReason, setChangeReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const result = await onSubmit({
      title,
      summary,
      description: description || null,
      opportunityTypeId,
      providerId,
      applicationUrl: applicationUrl || null,
      officialWebsiteUrl: officialWebsiteUrl || null,
      changeReason: changeReason || undefined,
    });

    setSubmitting(false);
    if (!result.ok) {
      setError(result.error ?? "Something went wrong.");
      return;
    }
    router.push(`/staff/opportunities/${result.opportunityId}`);
    router.refresh();
  }

  return (
    <form className="flex max-w-2xl flex-col gap-4" onSubmit={handleSubmit}>
      {error ? <Alert tone="danger">{error}</Alert> : null}

      <div>
        <Label htmlFor="opp-title">Title</Label>
        <Input id="opp-title" required value={title} onChange={(e) => setTitle(e.target.value)} />
      </div>

      <div>
        <Label htmlFor="opp-summary">Summary</Label>
        <Textarea id="opp-summary" required value={summary} onChange={(e) => setSummary(e.target.value)} />
        <HelpText>Shown on the public catalogue card.</HelpText>
      </div>

      <div>
        <Label htmlFor="opp-description">Description (optional)</Label>
        <Textarea id="opp-description" value={description ?? ""} onChange={(e) => setDescription(e.target.value)} />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="opp-type">Opportunity type</Label>
          <Select id="opp-type" required value={opportunityTypeId} onChange={(e) => setOpportunityTypeId(e.target.value)}>
            {opportunityTypes.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor="opp-provider">Provider</Label>
          <Select id="opp-provider" required value={providerId} onChange={(e) => setProviderId(e.target.value)}>
            {providers.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </Select>
          <HelpText>
            Provider not listed? <a href="/staff/organisations" className="underline">Create one first</a>.
          </HelpText>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="opp-application-url">Application URL (optional)</Label>
          <Input
            id="opp-application-url"
            type="url"
            value={applicationUrl ?? ""}
            onChange={(e) => setApplicationUrl(e.target.value)}
          />
        </div>
        <div>
          <Label htmlFor="opp-official-url">Official website URL (optional)</Label>
          <Input
            id="opp-official-url"
            type="url"
            value={officialWebsiteUrl ?? ""}
            onChange={(e) => setOfficialWebsiteUrl(e.target.value)}
          />
        </div>
      </div>

      {requireChangeReason ? (
        <div>
          <Label htmlFor="opp-change-reason">Reason for this change</Label>
          <Input
            id="opp-change-reason"
            required
            value={changeReason}
            onChange={(e) => setChangeReason(e.target.value)}
            placeholder="e.g. Corrected the funding summary per the official page"
          />
        </div>
      ) : null}

      <div>
        <Button type="submit" disabled={submitting}>
          {submitting ? "Saving…" : submitLabel}
        </Button>
      </div>
    </form>
  );
}
