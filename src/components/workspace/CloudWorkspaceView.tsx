"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Field";
import { Alert } from "@/components/ui/Alert";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/common/EmptyState";
import { useBuiltInOpportunities } from "@/hooks/useBuiltInOpportunities";
import { useCloudWorkspace } from "@/hooks/useCloudWorkspace";
import { useCloudCustomOpportunities } from "@/hooks/useCloudCustomOpportunities";
import { SyncStatusIndicator } from "@/components/account/SyncStatusIndicator";
import { CloudTrackedItem } from "./CloudTrackedItem";
import { CloudCustomOpportunityQuickAdd } from "./CloudCustomOpportunityQuickAdd";

interface CloudWorkspaceViewProps {
  studentProfileId: string;
}

export function CloudWorkspaceView({ studentProfileId }: CloudWorkspaceViewProps) {
  const { items: catalogue, loading: catalogueLoading } = useBuiltInOpportunities();
  const { snapshot, loading, error, patchTracking, saveNote, addTask, toggleTask, deleteTask } = useCloudWorkspace(studentProfileId);
  const { records: customOpportunities, create: createCustomOpportunity } = useCloudCustomOpportunities(studentProfileId);
  const [query, setQuery] = useState("");

  const titleById = useMemo(() => new Map(catalogue.map((item) => [item.id, item.title])), [catalogue]);

  const trackedActive = snapshot.tracking.filter((row) => !row.archived);
  const searchResults = useMemo(() => {
    if (query.trim().length < 2) return [];
    const already = new Set(trackedActive.map((row) => row.opportunityId));
    const q = query.trim().toLowerCase();
    return catalogue.filter((item) => !already.has(item.id) && item.title.toLowerCase().includes(q)).slice(0, 8);
  }, [query, catalogue, trackedActive]);

  if (loading || catalogueLoading) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <SyncStatusIndicator />
        <Link href="/account/sync" className="text-sm underline">
          Sync &amp; migration settings
        </Link>
      </div>

      {error ? <Alert tone="warning">{error}</Alert> : null}

      <div>
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search published opportunities to add to your cloud workspace…"
        />
        {searchResults.length > 0 ? (
          <ul className="mt-2 flex flex-col gap-1 rounded-lg border border-border p-2">
            {searchResults.map((item) => (
              <li key={item.id} className="flex items-center justify-between gap-2 px-2 py-1">
                <span className="text-sm text-foreground">{item.title}</span>
                <Button size="sm" variant="outline" onClick={() => patchTracking(item.id, { shortlisted: true })}>
                  Track
                </Button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      {trackedActive.length === 0 ? (
        <EmptyState
          title="Nothing tracked in your account yet"
          description="Search above to add a published opportunity, or bring in your guest data from Sync & migration."
        />
      ) : (
        <ul className="flex flex-col gap-3">
          {trackedActive.map((row) => (
            <CloudTrackedItem
              key={row.opportunityId}
              title={titleById.get(row.opportunityId) ?? "Opportunity"}
              tracking={row}
              note={snapshot.notes.find((n) => n.targetType === "built-in" && n.targetId === row.opportunityId)}
              tasks={snapshot.checklistTasks.filter((t) => t.targetType === "built-in" && t.targetId === row.opportunityId)}
              onPatchTracking={(patch) => patchTracking(row.opportunityId, patch)}
              onSaveNote={(noteText) => saveNote("built-in", row.opportunityId, noteText)}
              onAddTask={(taskText) => addTask("built-in", row.opportunityId, taskText)}
              onToggleTask={toggleTask}
              onDeleteTask={deleteTask}
            />
          ))}
        </ul>
      )}

      <div>
        <h2 className="text-base font-semibold text-foreground">Your custom opportunities ({customOpportunities.length})</h2>
        <p className="mt-1 text-sm text-foreground-muted">
          Custom opportunities you add here sync to your account. They are never labelled official or verified.
        </p>
        {customOpportunities.length > 0 ? (
          <ul className="mt-2 flex flex-col gap-2">
            {customOpportunities.map((custom) => (
              <li key={custom.id} className="rounded-lg border border-border p-3 text-sm">
                <p className="font-medium text-foreground">{custom.title}</p>
                <p className="text-foreground-muted">{custom.benefitSummary}</p>
              </li>
            ))}
          </ul>
        ) : null}
        <div className="mt-3">
          <CloudCustomOpportunityQuickAdd onCreate={createCustomOpportunity} />
        </div>
      </div>
    </div>
  );
}
