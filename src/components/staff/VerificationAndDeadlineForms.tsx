"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Checkbox, Input, Label, Select, Textarea } from "@/components/ui/Field";
import {
  createDeadlineCycle,
  createDeadlineOccurrence,
  createVerificationRecord,
} from "@/lib/db/actions/verification";

interface OptionRow {
  id: string;
  label: string;
}

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

/** Records an independent verification pass over one or more official sources — never immediately confirmed; see `PromoteRelationButton`'s "verification-record" kind. */
export function CreateVerificationRecordForm({
  opportunityId,
  sources,
  evidence,
}: {
  opportunityId: string;
  sources: OptionRow[];
  evidence: OptionRow[];
}) {
  const { error, busy, run } = useSubmitState();
  const [outcome, setOutcome] = useState<"verified" | "partially-verified" | "conflicting" | "changes-required" | "unable-to-verify" | "withdrawn">(
    "verified",
  );
  const [summary, setSummary] = useState("");
  const [officialSourceIds, setOfficialSourceIds] = useState<string[]>([]);
  const [linkedSourceEvidenceIds, setLinkedSourceEvidenceIds] = useState<string[]>([]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const ok = await run(() =>
      createVerificationRecord(opportunityId, { outcome, summary, officialSourceIds, linkedSourceEvidenceIds }),
    );
    if (ok) {
      setSummary("");
      setOfficialSourceIds([]);
      setLinkedSourceEvidenceIds([]);
    }
  }

  if (sources.length === 0) {
    return <p className="text-sm text-foreground-muted">Add and confirm an official source first before recording a verification.</p>;
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-2 rounded-md border border-border p-3">
      <p className="text-sm font-medium text-foreground">Record a verification pass</p>
      {error ? <Alert tone="danger">{error}</Alert> : null}
      <Label htmlFor="verification-outcome">Outcome</Label>
      <Select id="verification-outcome" value={outcome} onChange={(e) => setOutcome(e.target.value as typeof outcome)}>
        <option value="verified">Verified</option>
        <option value="partially-verified">Partially verified</option>
        <option value="conflicting">Conflicting</option>
        <option value="changes-required">Changes required</option>
        <option value="unable-to-verify">Unable to verify</option>
        <option value="withdrawn">Withdrawn</option>
      </Select>
      <Label htmlFor="verification-summary">Summary</Label>
      <Textarea id="verification-summary" required value={summary} onChange={(e) => setSummary(e.target.value)} />
      <p className="text-sm text-foreground-muted">Sources checked</p>
      <div className="flex flex-col gap-1">
        {sources.map((source) => (
          <Checkbox
            key={source.id}
            id={`verification-source-${source.id}`}
            label={source.label}
            checked={officialSourceIds.includes(source.id)}
            onChange={() =>
              setOfficialSourceIds((prev) => (prev.includes(source.id) ? prev.filter((id) => id !== source.id) : [...prev, source.id]))
            }
          />
        ))}
      </div>
      {evidence.length > 0 ? (
        <>
          <p className="text-sm text-foreground-muted">Evidence this confirms (optional)</p>
          <div className="flex flex-col gap-1">
            {evidence.map((ev) => (
              <Checkbox
                key={ev.id}
                id={`verification-evidence-${ev.id}`}
                label={ev.label}
                checked={linkedSourceEvidenceIds.includes(ev.id)}
                onChange={() =>
                  setLinkedSourceEvidenceIds((prev) => (prev.includes(ev.id) ? prev.filter((id) => id !== ev.id) : [...prev, ev.id]))
                }
              />
            ))}
          </div>
        </>
      ) : null}
      <Button type="submit" size="sm" disabled={busy || officialSourceIds.length === 0}>
        Save verification record
      </Button>
    </form>
  );
}

/** Drafts a new application cycle — never immediately active; see `PromoteRelationButton`'s "deadline-cycle" kind. */
export function CreateDeadlineCycleForm({ opportunityId }: { opportunityId: string }) {
  const { error, busy, run } = useSubmitState();
  const [cycleLabel, setCycleLabel] = useState("");
  const [cycleYear, setCycleYear] = useState("");
  const [recurrenceCadence, setRecurrenceCadence] = useState<"none" | "annual" | "irregular" | "unknown">("unknown");
  const [recurrenceDocumentedBySource, setRecurrenceDocumentedBySource] = useState(false);
  const [recurrenceSourceText, setRecurrenceSourceText] = useState("");

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const ok = await run(() =>
      createDeadlineCycle(opportunityId, {
        cycleLabel: cycleLabel || undefined,
        cycleYear: cycleYear ? Number(cycleYear) : undefined,
        recurrenceCadence,
        recurrenceDocumentedBySource,
        recurrenceSourceText: recurrenceSourceText || undefined,
      }),
    );
    if (ok) {
      setCycleLabel("");
      setCycleYear("");
      setRecurrenceSourceText("");
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-2 rounded-md border border-border p-3">
      <p className="text-sm font-medium text-foreground">Add application cycle</p>
      {error ? <Alert tone="danger">{error}</Alert> : null}
      <Label htmlFor="cycle-label">Cycle label (optional)</Label>
      <Input id="cycle-label" value={cycleLabel} onChange={(e) => setCycleLabel(e.target.value)} placeholder="e.g. 2027 intake" />
      <Label htmlFor="cycle-year">Cycle year (optional)</Label>
      <Input id="cycle-year" type="number" value={cycleYear} onChange={(e) => setCycleYear(e.target.value)} />
      <Label htmlFor="cycle-recurrence">Recurrence</Label>
      <Select id="cycle-recurrence" value={recurrenceCadence} onChange={(e) => setRecurrenceCadence(e.target.value as typeof recurrenceCadence)}>
        <option value="unknown">Unknown</option>
        <option value="none">Does not recur</option>
        <option value="annual">Annual</option>
        <option value="irregular">Irregular</option>
      </Select>
      <Checkbox
        id="cycle-recurrence-documented"
        label="Recurrence is documented by an official source"
        checked={recurrenceDocumentedBySource}
        onChange={(e) => setRecurrenceDocumentedBySource(e.target.checked)}
      />
      <Label htmlFor="cycle-recurrence-text">Source wording for recurrence (optional)</Label>
      <Textarea id="cycle-recurrence-text" value={recurrenceSourceText} onChange={(e) => setRecurrenceSourceText(e.target.value)} />
      <Button type="submit" size="sm" disabled={busy}>
        Add cycle
      </Button>
    </form>
  );
}

/** Adds an occurrence (opening/closing date) within a cycle — never immediately active; see `PromoteRelationButton`'s "deadline-occurrence" kind. */
export function CreateDeadlineOccurrenceForm({ opportunityId, cycles }: { opportunityId: string; cycles: OptionRow[] }) {
  const { error, busy, run } = useSubmitState();
  const [deadlineCycleId, setDeadlineCycleId] = useState(cycles[0]?.id ?? "");
  const [role, setRole] = useState<"applicant-submission" | "institutional-nomination" | "embassy-nomination" | "programme-round" | "document-supplement" | "other">(
    "applicant-submission",
  );
  const [precision, setPrecision] = useState<"exact" | "estimated" | "rolling" | "unknown" | "program-specific" | "institution-specific">(
    "unknown",
  );
  const [closingDate, setClosingDate] = useState("");
  const [rawText, setRawText] = useState("");
  const [sourceTimezone, setSourceTimezone] = useState("");
  const [verificationStatus, setVerificationStatus] = useState<"verified" | "unverified" | "stale" | "conflicting" | "withdrawn" | "archived" | "estimated-from-previous-cycle">(
    "unverified",
  );

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const ok = await run(() =>
      createDeadlineOccurrence(opportunityId, {
        deadlineCycleId,
        role,
        precision,
        closingDate: closingDate || undefined,
        rawText,
        sourceTimezone: sourceTimezone || undefined,
        verificationStatus,
      }),
    );
    if (ok) {
      setClosingDate("");
      setRawText("");
    }
  }

  if (cycles.length === 0) {
    return <p className="text-sm text-foreground-muted">Add an application cycle first before recording a deadline occurrence.</p>;
  }

  const datesAllowed = precision !== "rolling" && precision !== "unknown";

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-2 rounded-md border border-border p-3">
      <p className="text-sm font-medium text-foreground">Add deadline occurrence</p>
      {error ? <Alert tone="danger">{error}</Alert> : null}
      <Label htmlFor="occurrence-cycle">Cycle</Label>
      <Select id="occurrence-cycle" value={deadlineCycleId} onChange={(e) => setDeadlineCycleId(e.target.value)}>
        {cycles.map((c) => (
          <option key={c.id} value={c.id}>
            {c.label}
          </option>
        ))}
      </Select>
      <Label htmlFor="occurrence-role">Role</Label>
      <Select id="occurrence-role" value={role} onChange={(e) => setRole(e.target.value as typeof role)}>
        <option value="applicant-submission">Applicant submission</option>
        <option value="institutional-nomination">Institutional nomination</option>
        <option value="embassy-nomination">Embassy nomination</option>
        <option value="programme-round">Programme round</option>
        <option value="document-supplement">Document supplement</option>
        <option value="other">Other</option>
      </Select>
      <Label htmlFor="occurrence-precision">Precision</Label>
      <Select id="occurrence-precision" value={precision} onChange={(e) => setPrecision(e.target.value as typeof precision)}>
        <option value="unknown">Unknown</option>
        <option value="rolling">Rolling</option>
        <option value="estimated">Estimated</option>
        <option value="exact">Exact</option>
        <option value="program-specific">Program-specific</option>
        <option value="institution-specific">Institution-specific</option>
      </Select>
      {datesAllowed ? (
        <>
          <Label htmlFor="occurrence-closing">Closing date</Label>
          <Input id="occurrence-closing" type="date" value={closingDate} onChange={(e) => setClosingDate(e.target.value)} />
        </>
      ) : (
        <p className="text-xs text-foreground-subtle">Rolling/unknown occurrences never carry a date — the database rejects one.</p>
      )}
      <Label htmlFor="occurrence-timezone">Source timezone (optional)</Label>
      <Input id="occurrence-timezone" value={sourceTimezone} onChange={(e) => setSourceTimezone(e.target.value)} placeholder="e.g. Europe/Berlin" />
      <Label htmlFor="occurrence-verification">Verification status</Label>
      <Select id="occurrence-verification" value={verificationStatus} onChange={(e) => setVerificationStatus(e.target.value as typeof verificationStatus)}>
        <option value="unverified">Unverified</option>
        <option value="verified">Verified</option>
        <option value="stale">Stale</option>
        <option value="conflicting">Conflicting</option>
        <option value="estimated-from-previous-cycle">Estimated from previous cycle</option>
        <option value="withdrawn">Withdrawn</option>
        <option value="archived">Archived</option>
      </Select>
      <Label htmlFor="occurrence-raw-text">Original source wording</Label>
      <Textarea id="occurrence-raw-text" required value={rawText} onChange={(e) => setRawText(e.target.value)} />
      <Button type="submit" size="sm" disabled={busy}>
        Add occurrence
      </Button>
    </form>
  );
}
