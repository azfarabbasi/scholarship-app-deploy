"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Input, Label, Select } from "@/components/ui/Field";
import { assignReviewer } from "@/lib/db/actions/reviews";
import type { OptionRow } from "@/lib/db/reference-data";

export function AssignReviewerForm({ opportunityId, reviewers }: { opportunityId: string; reviewers: OptionRow[] }) {
  const router = useRouter();
  const [reviewerId, setReviewerId] = useState(reviewers[0]?.id ?? "");
  const [dueAt, setDueAt] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const result = await assignReviewer(opportunityId, reviewerId, dueAt || undefined);
    setBusy(false);
    if (!result.ok) {
      setError(result.error ?? "Could not assign a reviewer.");
      return;
    }
    router.refresh();
  }

  if (reviewers.length === 0) {
    return <p className="text-sm text-foreground-muted">No eligible reviewer is available for this opportunity.</p>;
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-2">
      {error ? (
        <div className="w-full">
          <Alert tone="danger">{error}</Alert>
        </div>
      ) : null}
      <div>
        <Label htmlFor={`reviewer-${opportunityId}`}>Reviewer</Label>
        <Select id={`reviewer-${opportunityId}`} value={reviewerId} onChange={(e) => setReviewerId(e.target.value)}>
          {reviewers.map((r) => (
            <option key={r.id} value={r.id}>
              {r.label}
            </option>
          ))}
        </Select>
      </div>
      <div>
        <Label htmlFor={`due-${opportunityId}`}>Due (optional)</Label>
        <Input id={`due-${opportunityId}`} type="date" value={dueAt} onChange={(e) => setDueAt(e.target.value)} />
      </div>
      <Button type="submit" size="sm" disabled={busy}>
        Assign
      </Button>
    </form>
  );
}
