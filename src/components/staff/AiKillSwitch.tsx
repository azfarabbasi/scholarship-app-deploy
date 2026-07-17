"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { setAiManuallyDisabled } from "@/lib/db/actions/ai-staff";

interface AiKillSwitchProps {
  manuallyDisabled: boolean;
  disabledReason: string | null;
}

/**
 * The runtime kill switch — distinct from the `AI_ENABLED` env var, which
 * only takes effect on the next deploy/restart. This lets an Administrator
 * pause the assistant instantly during an incident, and lets any staff
 * member see clearly whether it's currently active.
 */
export function AiKillSwitch({ manuallyDisabled, disabledReason }: AiKillSwitchProps) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [reason, setReason] = useState("");

  async function handleDisable() {
    setBusy(true);
    await setAiManuallyDisabled(true, reason.trim() || "Paused by staff");
    setBusy(false);
    router.refresh();
  }

  async function handleEnable() {
    setBusy(true);
    await setAiManuallyDisabled(false);
    setBusy(false);
    router.refresh();
  }

  if (manuallyDisabled) {
    return (
      <div className="flex flex-col gap-2 rounded-lg border border-danger/30 bg-danger-tint p-4">
        <p className="text-sm font-medium text-foreground">AI assistant is manually disabled.</p>
        {disabledReason ? <p className="text-xs text-foreground-muted">Reason: {disabledReason}</p> : null}
        <Button size="sm" variant="outline" disabled={busy} onClick={() => void handleEnable()} className="w-fit">
          Re-enable AI assistant
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-border p-4">
      <p className="text-sm font-medium text-foreground">AI assistant is active (subject to the AI_ENABLED environment setting).</p>
      <div className="flex flex-wrap items-center gap-2">
        <input
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          placeholder="Reason (optional)"
          className="h-9 flex-1 min-w-[12rem] rounded-md border border-border bg-surface px-3 text-sm text-foreground"
        />
        <Button size="sm" variant="danger" disabled={busy} onClick={() => void handleDisable()}>
          Disable now
        </Button>
      </div>
    </div>
  );
}
