"use client";

import { Cloud, CloudOff, AlertTriangle, Check, Loader2, PauseCircle } from "lucide-react";
import { useSyncStatus } from "@/hooks/useSyncStatus";

const LABELS: Record<string, string> = {
  saved: "Saved",
  saving: "Saving…",
  offline: "Offline — will sync when you reconnect",
  paused: "Sync paused",
  failed: "Sync failed — will retry",
  conflict: "Conflict needs review",
};

const ICONS = {
  saved: Check,
  saving: Loader2,
  offline: CloudOff,
  paused: PauseCircle,
  failed: AlertTriangle,
  conflict: AlertTriangle,
};

export function SyncStatusIndicator() {
  const { status, lastSyncedAt } = useSyncStatus();
  const Icon = ICONS[status] ?? Cloud;

  return (
    <div className="flex items-center gap-1.5 text-xs text-foreground-muted" role="status">
      <Icon className={`h-3.5 w-3.5 ${status === "saving" ? "animate-spin" : ""}`} aria-hidden="true" />
      <span>{LABELS[status] ?? "Synced"}</span>
      {status === "saved" && lastSyncedAt ? <span className="text-foreground-subtle">· {new Date(lastSyncedAt).toLocaleTimeString()}</span> : null}
    </div>
  );
}
