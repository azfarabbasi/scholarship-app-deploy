"use client";

import { CheckCircle2, XCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { Skeleton } from "@/components/ui/Skeleton";
import { getStorageDiagnostics, type StorageDiagnostics } from "@/lib/storage/diagnostics";
import { subscribeToStorageChange } from "@/lib/storage/events";

function StatusRow({ ok, label }: { ok: boolean; label: string }) {
  return (
    <li className="flex items-center gap-2 text-sm">
      {ok ? (
        <CheckCircle2 className="h-4 w-4 text-success" aria-hidden="true" />
      ) : (
        <XCircle className="h-4 w-4 text-danger" aria-hidden="true" />
      )}
      <span>
        {label}: <strong>{ok ? "Available" : "Unavailable"}</strong>
      </span>
    </li>
  );
}

export function StorageDiagnosticsSection() {
  const [diagnostics, setDiagnostics] = useState<StorageDiagnostics | null>(null);

  useEffect(() => {
    const refresh = () => void getStorageDiagnostics().then(setDiagnostics);
    refresh();
    const unsubscribers = [
      subscribeToStorageChange("workspace", refresh),
      subscribeToStorageChange("customOpportunities", refresh),
      subscribeToStorageChange("backup", refresh),
    ];
    return () => unsubscribers.forEach((unsubscribe) => unsubscribe());
  }, []);

  if (!diagnostics) {
    return <Skeleton className="h-40 w-full" />;
  }

  return (
    <div className="flex flex-col gap-3">
      {!diagnostics.indexedDbAvailable ? (
        <p className="text-sm font-medium text-danger">
          IndexedDB is unavailable in this browser. Guest data will not persist between visits.
        </p>
      ) : null}
      <ul className="flex flex-col gap-1.5">
        <StatusRow ok={diagnostics.localStorageAvailable} label="Local storage" />
        <StatusRow ok={diagnostics.indexedDbAvailable} label="IndexedDB" />
      </ul>
      <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
        <div>
          <dt className="text-foreground-muted">Schema version</dt>
          <dd className="font-medium text-foreground">{diagnostics.schemaVersion}</dd>
        </div>
        <div>
          <dt className="text-foreground-muted">Tracked records</dt>
          <dd className="font-medium text-foreground">{diagnostics.workspaceRecordCount}</dd>
        </div>
        <div>
          <dt className="text-foreground-muted">Custom opportunities</dt>
          <dd className="font-medium text-foreground">{diagnostics.customOpportunityCount}</dd>
        </div>
        <div>
          <dt className="text-foreground-muted">Last backup</dt>
          <dd className="font-medium text-foreground">
            {diagnostics.lastBackupAt ? new Date(diagnostics.lastBackupAt).toLocaleString() : "Never"}
          </dd>
        </div>
      </dl>
    </div>
  );
}
