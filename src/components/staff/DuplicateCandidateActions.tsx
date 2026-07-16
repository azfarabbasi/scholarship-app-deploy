"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Field";
import { dismissDuplicateCandidate, mergeDuplicates, runDuplicateDetection } from "@/lib/db/actions/duplicates";

export function RunDetectionButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  return (
    <div className="flex items-center gap-3">
      <Button
        size="sm"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          const result = await runDuplicateDetection();
          setBusy(false);
          setMessage(result.ok ? `Found ${result.created ?? 0} new candidate(s).` : result.error ?? "Failed.");
          router.refresh();
        }}
      >
        {busy ? "Scanning…" : "Run duplicate detection"}
      </Button>
      {message ? <span className="text-sm text-foreground-muted">{message}</span> : null}
    </div>
  );
}

export function DuplicateCandidateActions({ candidateId }: { candidateId: string }) {
  const router = useRouter();
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  async function run(fn: () => Promise<{ ok: boolean }>) {
    setBusy(true);
    await fn();
    setBusy(false);
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-2">
      <Input placeholder="Reason" value={reason} onChange={(e) => setReason(e.target.value)} className="max-w-xs" />
      <div className="flex gap-2">
        <Button size="sm" disabled={busy || !reason} onClick={() => run(() => mergeDuplicates(candidateId, reason))}>
          Merge (keep canonical)
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={busy || !reason}
          onClick={() => run(() => dismissDuplicateCandidate(candidateId, reason))}
        >
          Dismiss (false positive)
        </Button>
      </div>
    </div>
  );
}
