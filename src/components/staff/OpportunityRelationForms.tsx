"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Checkbox, Input, Label, Select, Textarea } from "@/components/ui/Field";
import type { OptionRow } from "@/lib/db/reference-data";
import {
  addDocumentRequirement,
  addEligibilityRule,
  addFundingBenefit,
  addOfficialSource,
  addSourceEvidence,
  setOpportunityTaxonomies,
} from "@/lib/db/actions/opportunity-relations";

function useSubmitState() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  async function run(fn: () => Promise<{ ok: boolean; error?: string }>) {
    setBusy(true);
    setError(null);
    const result = await fn();
    setBusy(false);
    if (!result.ok) {
      setError(result.error ?? "Something went wrong.");
      return false;
    }
    router.refresh();
    return true;
  }
  return { error, busy, run };
}

export function AddOfficialSourceForm({ opportunityId, providers }: { opportunityId: string; providers: OptionRow[] }) {
  const { error, busy, run } = useSubmitState();
  const [url, setUrl] = useState("");
  const [label, setLabel] = useState("");
  const [sourceOrganisationName, setSourceOrganisationName] = useState("");
  const [publisherProviderId, setPublisherProviderId] = useState("");
  const [lastCheckedAt, setLastCheckedAt] = useState(() => new Date().toISOString().slice(0, 10));

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const ok = await run(() =>
      addOfficialSource(opportunityId, {
        url,
        kind: "opportunity-page",
        label,
        sourceOrganisationName,
        publisherProviderId: publisherProviderId || undefined,
        lastCheckedAt,
      }),
    );
    if (ok) {
      setUrl("");
      setLabel("");
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-2 rounded-md border border-border p-3">
      <p className="text-sm font-medium text-foreground">Add official source</p>
      {error ? <Alert tone="danger">{error}</Alert> : null}
      <Label htmlFor="src-label">Label</Label>
      <Input id="src-label" required value={label} onChange={(e) => setLabel(e.target.value)} />
      <Label htmlFor="src-url">URL</Label>
      <Input id="src-url" type="url" required value={url} onChange={(e) => setUrl(e.target.value)} />
      <Label htmlFor="src-org-name">Source organisation name</Label>
      <Input id="src-org-name" required value={sourceOrganisationName} onChange={(e) => setSourceOrganisationName(e.target.value)} />
      <Label htmlFor="src-provider">Responsible provider</Label>
      <Select id="src-provider" value={publisherProviderId} onChange={(e) => setPublisherProviderId(e.target.value)}>
        <option value="">None</option>
        {providers.map((p) => (
          <option key={p.id} value={p.id}>
            {p.label}
          </option>
        ))}
      </Select>
      <Label htmlFor="src-checked">Last checked</Label>
      <Input id="src-checked" type="date" required value={lastCheckedAt} onChange={(e) => setLastCheckedAt(e.target.value)} />
      <Button type="submit" size="sm" disabled={busy}>
        Add source
      </Button>
    </form>
  );
}

export function AddSourceEvidenceForm({ opportunityId, sources }: { opportunityId: string; sources: OptionRow[] }) {
  const { error, busy, run } = useSubmitState();
  const [officialSourceId, setOfficialSourceId] = useState(sources[0]?.id ?? "");
  const [evidenceText, setEvidenceText] = useState("");
  const [sourceLocator, setSourceLocator] = useState("");

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const ok = await run(() =>
      addSourceEvidence(opportunityId, { officialSourceId, kind: "fact", evidenceText, sourceLocator: sourceLocator || undefined }),
    );
    if (ok) setEvidenceText("");
  }

  if (sources.length === 0) {
    return <p className="text-sm text-foreground-muted">Add an official source first before capturing evidence.</p>;
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-2 rounded-md border border-border p-3">
      <p className="text-sm font-medium text-foreground">Capture source evidence</p>
      {error ? <Alert tone="danger">{error}</Alert> : null}
      <Label htmlFor="evidence-source">Official source</Label>
      <Select id="evidence-source" value={officialSourceId} onChange={(e) => setOfficialSourceId(e.target.value)}>
        {sources.map((s) => (
          <option key={s.id} value={s.id}>
            {s.label}
          </option>
        ))}
      </Select>
      <Label htmlFor="evidence-locator">Locator (section/anchor, optional)</Label>
      <Input id="evidence-locator" value={sourceLocator} onChange={(e) => setSourceLocator(e.target.value)} />
      <Label htmlFor="evidence-text">Exact wording / observation</Label>
      <Textarea id="evidence-text" required value={evidenceText} onChange={(e) => setEvidenceText(e.target.value)} />
      <Button type="submit" size="sm" disabled={busy}>
        Save evidence
      </Button>
    </form>
  );
}

export function AddDocumentRequirementForm({
  opportunityId,
  templates,
  evidence,
}: {
  opportunityId: string;
  templates: OptionRow[];
  evidence: OptionRow[];
}) {
  const { error, busy, run } = useSubmitState();
  const [requiredDocumentTemplateId, setTemplateId] = useState(templates[0]?.id ?? "");
  const [requirementLevel, setRequirementLevel] = useState<"required" | "conditionally-required" | "optional">("required");
  const [sourceEvidenceId, setSourceEvidenceId] = useState(evidence[0]?.id ?? "");
  const [instructions, setInstructions] = useState("");

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    await run(() =>
      addDocumentRequirement(opportunityId, {
        requiredDocumentTemplateId,
        requirementLevel,
        sourceEvidenceId,
        instructions: instructions || undefined,
      }),
    );
  }

  if (evidence.length === 0) {
    return <p className="text-sm text-foreground-muted">Capture source evidence first before adding a document requirement.</p>;
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-2 rounded-md border border-border p-3">
      <p className="text-sm font-medium text-foreground">Add required document</p>
      {error ? <Alert tone="danger">{error}</Alert> : null}
      <Label htmlFor="doc-template">Document</Label>
      <Select id="doc-template" value={requiredDocumentTemplateId} onChange={(e) => setTemplateId(e.target.value)}>
        {templates.map((t) => (
          <option key={t.id} value={t.id}>
            {t.label}
          </option>
        ))}
      </Select>
      <Label htmlFor="doc-level">Requirement level</Label>
      <Select id="doc-level" value={requirementLevel} onChange={(e) => setRequirementLevel(e.target.value as typeof requirementLevel)}>
        <option value="required">Required</option>
        <option value="conditionally-required">Conditionally required</option>
        <option value="optional">Optional</option>
      </Select>
      <Label htmlFor="doc-evidence">Source evidence</Label>
      <Select id="doc-evidence" value={sourceEvidenceId} onChange={(e) => setSourceEvidenceId(e.target.value)}>
        {evidence.map((ev) => (
          <option key={ev.id} value={ev.id}>
            {ev.label}
          </option>
        ))}
      </Select>
      <Label htmlFor="doc-instructions">Instructions (optional)</Label>
      <Input id="doc-instructions" value={instructions} onChange={(e) => setInstructions(e.target.value)} />
      <Button type="submit" size="sm" disabled={busy}>
        Add requirement
      </Button>
    </form>
  );
}

export function AddEligibilityRuleForm({ opportunityId, evidence }: { opportunityId: string; evidence: OptionRow[] }) {
  const { error, busy, run } = useSubmitState();
  const [fieldKey, setFieldKey] = useState("");
  const [operator, setOperator] = useState<"equals" | "in" | "exists">("equals");
  const [expectedValue, setExpectedValue] = useState("");
  const [explanation, setExplanation] = useState("");
  const [sourceEvidenceId, setSourceEvidenceId] = useState(evidence[0]?.id ?? "");

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const ok = await run(() =>
      addEligibilityRule(opportunityId, {
        kind: "other",
        fieldKey,
        operator,
        expectedValue: JSON.stringify(expectedValue),
        explanation,
        sourceEvidenceId,
      }),
    );
    if (ok) {
      setFieldKey("");
      setExpectedValue("");
      setExplanation("");
    }
  }

  if (evidence.length === 0) {
    return <p className="text-sm text-foreground-muted">Capture source evidence first before adding an eligibility rule.</p>;
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-2 rounded-md border border-border p-3">
      <p className="text-sm font-medium text-foreground">Add eligibility rule</p>
      {error ? <Alert tone="danger">{error}</Alert> : null}
      <Label htmlFor="rule-field">Field key</Label>
      <Input id="rule-field" required value={fieldKey} onChange={(e) => setFieldKey(e.target.value)} placeholder="e.g. nationality" />
      <Label htmlFor="rule-operator">Operator</Label>
      <Select id="rule-operator" value={operator} onChange={(e) => setOperator(e.target.value as typeof operator)}>
        <option value="equals">Equals</option>
        <option value="in">In (one of)</option>
        <option value="exists">Exists</option>
      </Select>
      <Label htmlFor="rule-value">Expected value</Label>
      <Input id="rule-value" required value={expectedValue} onChange={(e) => setExpectedValue(e.target.value)} />
      <Label htmlFor="rule-evidence">Source evidence</Label>
      <Select id="rule-evidence" value={sourceEvidenceId} onChange={(e) => setSourceEvidenceId(e.target.value)}>
        {evidence.map((ev) => (
          <option key={ev.id} value={ev.id}>
            {ev.label}
          </option>
        ))}
      </Select>
      <Label htmlFor="rule-explanation">Student-facing explanation</Label>
      <Textarea id="rule-explanation" required value={explanation} onChange={(e) => setExplanation(e.target.value)} />
      <Button type="submit" size="sm" disabled={busy}>
        Add rule
      </Button>
    </form>
  );
}

export function AddFundingBenefitForm({ opportunityId, fundingTypes }: { opportunityId: string; fundingTypes: OptionRow[] }) {
  const { error, busy, run } = useSubmitState();
  const [fundingTypeId, setFundingTypeId] = useState(fundingTypes[0]?.id ?? "");
  const [kind, setKind] = useState<"tuition" | "stipend" | "travel" | "accommodation" | "insurance" | "research-costs" | "application-fee" | "other">("other");
  const [summary, setSummary] = useState("");

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const ok = await run(() => addFundingBenefit(opportunityId, { fundingTypeId, kind, summary }));
    if (ok) setSummary("");
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-2 rounded-md border border-border p-3">
      <p className="text-sm font-medium text-foreground">Add funding benefit</p>
      {error ? <Alert tone="danger">{error}</Alert> : null}
      <Label htmlFor="benefit-type">Funding type</Label>
      <Select id="benefit-type" value={fundingTypeId} onChange={(e) => setFundingTypeId(e.target.value)}>
        {fundingTypes.map((t) => (
          <option key={t.id} value={t.id}>
            {t.label}
          </option>
        ))}
      </Select>
      <Label htmlFor="benefit-kind">Benefit kind</Label>
      <Select id="benefit-kind" value={kind} onChange={(e) => setKind(e.target.value as typeof kind)}>
        <option value="tuition">Tuition</option>
        <option value="stipend">Stipend</option>
        <option value="travel">Travel</option>
        <option value="accommodation">Accommodation</option>
        <option value="insurance">Insurance</option>
        <option value="research-costs">Research costs</option>
        <option value="application-fee">Application fee</option>
        <option value="other">Other</option>
      </Select>
      <Label htmlFor="benefit-summary">Summary</Label>
      <Textarea id="benefit-summary" required value={summary} onChange={(e) => setSummary(e.target.value)} />
      <Button type="submit" size="sm" disabled={busy}>
        Add benefit
      </Button>
    </form>
  );
}

export function TaxonomyPicker({
  opportunityId,
  countries,
  studyLevels,
  selectedCountryIds,
  selectedStudyLevelIds,
}: {
  opportunityId: string;
  countries: OptionRow[];
  studyLevels: OptionRow[];
  selectedCountryIds: string[];
  selectedStudyLevelIds: string[];
}) {
  const { error, busy, run } = useSubmitState();
  const [countryIds, setCountryIds] = useState<string[]>(selectedCountryIds);
  const [studyLevelIds, setStudyLevelIds] = useState<string[]>(selectedStudyLevelIds);

  async function handleSave() {
    await run(() => setOpportunityTaxonomies(opportunityId, { countryIds, studyLevelIds }));
  }

  return (
    <div className="flex flex-col gap-2 rounded-md border border-border p-3">
      <p className="text-sm font-medium text-foreground">Countries &amp; study levels</p>
      {error ? <Alert tone="danger">{error}</Alert> : null}
      <div className="grid grid-cols-2 gap-x-4 gap-y-1 sm:grid-cols-3">
        {countries.map((country) => (
          <Checkbox
            key={country.id}
            id={`country-${country.id}`}
            label={country.label}
            checked={countryIds.includes(country.id)}
            onChange={() =>
              setCountryIds((prev) => (prev.includes(country.id) ? prev.filter((id) => id !== country.id) : [...prev, country.id]))
            }
          />
        ))}
      </div>
      <div className="flex flex-wrap gap-3">
        {studyLevels.map((level) => (
          <Checkbox
            key={level.id}
            id={`level-${level.id}`}
            label={level.label}
            checked={studyLevelIds.includes(level.id)}
            onChange={() =>
              setStudyLevelIds((prev) => (prev.includes(level.id) ? prev.filter((id) => id !== level.id) : [...prev, level.id]))
            }
          />
        ))}
      </div>
      <div>
        <Button type="button" size="sm" disabled={busy} onClick={handleSave}>
          Save coverage
        </Button>
      </div>
    </div>
  );
}
