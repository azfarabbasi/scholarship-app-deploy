"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Label } from "@/components/ui/Field";
import { WorkflowStatusBadge } from "@/components/staff/WorkflowStatusBadge";
import { bulkPublishDrafts, type BulkPublishResult } from "@/lib/db/actions/bulk-publish";
import type { OpportunityWorkflowStatus } from "@/lib/workflow/opportunity-workflow";

export interface OpportunityRow {
  id: string;
  title: string;
  status: OpportunityWorkflowStatus;
  updatedAt: Date;
  providerName: string;
}

const NOT_SELECTABLE: readonly OpportunityWorkflowStatus[] = ["published", "archived", "rejected", "superseded", "merged"];

const DEFAULT_SUMMARY =
  "Bulk-reviewed as part of the legacy migration cleanup: the official source URL was confirmed reachable and matches the imported title/provider, and the imported eligibility/benefit text was checked against it.";

export function BulkPublishTable({ rows }: { rows: OpportunityRow[] }) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [showModal, setShowModal] = useState(false);
  const [summary, setSummary] = useState(DEFAULT_SUMMARY);
  const [busy, setBusy] = useState(false);
  const [results, setResults] = useState<BulkPublishResult[] | null>(null);
  const [topLevelError, setTopLevelError] = useState<string | null>(null);

  const selectableRows = useMemo(() => rows.filter((r) => !NOT_SELECTABLE.includes(r.status)), [rows]);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    setSelected((prev) => (prev.size === selectableRows.length ? new Set() : new Set(selectableRows.map((r) => r.id))));
  }

  async function confirmPublish() {
    setBusy(true);
    setTopLevelError(null);
    setResults(null);
    try {
      const result = await bulkPublishDrafts(Array.from(selected), summary);
      if (!result.ok && !result.results) {
        setTopLevelError(result.error ?? "Could not publish the selected opportunities.");
        return;
      }
      setResults(result.results ?? []);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  function closeModal() {
    setShowModal(false);
    setResults(null);
    setTopLevelError(null);
    setSelected(new Set());
  }

  return (
    <>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-foreground-muted">
          {selected.size > 0 ? `${selected.size} selected` : `Select opportunities to publish them together.`}
        </p>
        <Button size="sm" disabled={selected.size === 0} onClick={() => setShowModal(true)}>
          Publish selected{selected.size > 0 ? ` (${selected.size})` : ""}
        </Button>
      </div>

      <div className="overflow-x-auto rounded-lg border border-border bg-surface shadow-e1">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-border bg-surface-muted text-xs uppercase tracking-wide text-foreground-muted">
            <tr>
              <th scope="col" className="w-10 px-3 py-2.5">
                <input
                  type="checkbox"
                  aria-label="Select all publishable opportunities"
                  checked={selectableRows.length > 0 && selected.size === selectableRows.length}
                  onChange={toggleAll}
                />
              </th>
              <th scope="col" className="px-3 py-2.5 font-semibold">
                Title
              </th>
              <th scope="col" className="px-3 py-2.5 font-semibold">
                Provider
              </th>
              <th scope="col" className="px-3 py-2.5 font-semibold">
                Status
              </th>
              <th scope="col" className="px-3 py-2.5 font-semibold">
                Updated
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-3 py-12 text-center">
                  <p className="font-medium text-foreground">No opportunities match this filter.</p>
                  <p className="mt-1 text-sm text-foreground-muted">
                    Try{" "}
                    <Link href="/staff/opportunities" className="text-brand hover:underline">
                      clearing the status filter
                    </Link>{" "}
                    or start a new draft.
                  </p>
                </td>
              </tr>
            ) : (
              rows.map((row) => {
                const canSelect = !NOT_SELECTABLE.includes(row.status);
                return (
                  <tr key={row.id} className="border-t border-border transition-colors hover:bg-surface-muted/50">
                    <td className="px-3 py-2.5">
                      <input
                        type="checkbox"
                        aria-label={`Select ${row.title}`}
                        checked={selected.has(row.id)}
                        disabled={!canSelect}
                        onChange={() => toggle(row.id)}
                      />
                    </td>
                    <td className="px-3 py-2.5">
                      <Link
                        href={`/staff/opportunities/${row.id}`}
                        className="rounded font-medium text-foreground hover:text-brand hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus-ring)]"
                      >
                        {row.title}
                      </Link>
                    </td>
                    <td className="px-3 py-2.5 text-foreground-muted">{row.providerName}</td>
                    <td className="px-3 py-2.5">
                      <WorkflowStatusBadge status={row.status} />
                    </td>
                    <td className="px-3 py-2.5 whitespace-nowrap text-foreground-muted">{row.updatedAt.toLocaleString()}</td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {showModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-lg border border-border bg-surface p-5 shadow-e2">
            <h2 className="text-lg font-semibold text-foreground">Publish {selected.size} opportunit{selected.size === 1 ? "y" : "ies"}</h2>
            <p className="mt-1 text-sm text-foreground-muted">
              For each one, this confirms its official source, accepts its evidence, records a verification, and walks it
              through review and approval — the same steps as doing it by hand, just automated. It uses the bootstrap
              administrator self-review exception, so it only works signed in as that account.
            </p>

            {!results ? (
              <>
                <div className="mt-4">
                  <Label htmlFor="bulk-verification-summary">Verification summary (applied to every selected record)</Label>
                  <textarea
                    id="bulk-verification-summary"
                    className="mt-1 w-full rounded-md border border-border bg-surface-muted p-2 text-sm text-foreground"
                    rows={4}
                    value={summary}
                    onChange={(e) => setSummary(e.target.value)}
                  />
                </div>

                {topLevelError ? (
                  <Alert tone="danger" className="mt-3">
                    {topLevelError}
                  </Alert>
                ) : null}

                <div className="mt-4 flex justify-end gap-2">
                  <Button size="sm" variant="ghost" onClick={closeModal} disabled={busy}>
                    Cancel
                  </Button>
                  <Button size="sm" onClick={() => void confirmPublish()} disabled={busy}>
                    {busy ? "Publishing…" : `Publish ${selected.size}`}
                  </Button>
                </div>
              </>
            ) : (
              <>
                <ul className="mt-4 flex flex-col gap-1.5 text-sm">
                  {results.map((r) => (
                    <li key={r.opportunityId} className={r.ok ? "text-success" : "text-danger"}>
                      {r.ok ? "✓" : "✗"} {r.title}
                      {r.error ? ` — ${r.error}` : ""}
                    </li>
                  ))}
                </ul>
                <p className="mt-3 text-sm text-foreground-muted">
                  {results.filter((r) => r.ok).length} of {results.length} published.
                </p>
                <div className="mt-4 flex justify-end">
                  <Button size="sm" onClick={closeModal}>
                    Close
                  </Button>
                </div>
              </>
            )}
          </div>
        </div>
      ) : null}
    </>
  );
}
