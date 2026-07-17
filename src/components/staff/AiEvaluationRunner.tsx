"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { triggerAiEvaluationRun } from "@/lib/db/actions/ai-staff";

export function AiEvaluationRunner() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function handleRun() {
    setBusy(true);
    setMessage(null);
    const result = await triggerAiEvaluationRun();
    setBusy(false);
    setMessage(result.ok ? `${result.passed}/${result.total} cases passed.` : (result.error ?? "Failed to run evaluation suite."));
    router.refresh();
  }

  return (
    <div className="flex items-center gap-3">
      <Button size="sm" disabled={busy} onClick={() => void handleRun()}>
        {busy ? "Running…" : "Run evaluation suite"}
      </Button>
      {message ? <span className="text-sm text-foreground-muted">{message}</span> : null}
    </div>
  );
}
