"use client";

import { AlertTriangle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Dialog, DialogClose, DialogContent, DialogTrigger } from "@/components/ui/Dialog";
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
        <Dialog>
          <DialogTrigger asChild>
            <Button size="sm" disabled={busy || !reason}>
              Merge (keep canonical)
            </Button>
          </DialogTrigger>
          <DialogContent
            title="Merge these opportunities?"
            description="The non-canonical record is marked merged and its URL redirects to the canonical one. This cannot be undone."
          >
            <Alert tone="warning" className="mt-2">
              <span className="inline-flex items-center gap-1.5">
                <AlertTriangle className="h-4 w-4" aria-hidden="true" /> This cannot be undone.
              </span>
            </Alert>
            <div className="mt-4 flex justify-end gap-2">
              <DialogClose asChild>
                <Button variant="outline" size="sm">
                  Cancel
                </Button>
              </DialogClose>
              <DialogClose asChild>
                <Button variant="danger" size="sm" onClick={() => run(() => mergeDuplicates(candidateId, reason))}>
                  Merge
                </Button>
              </DialogClose>
            </div>
          </DialogContent>
        </Dialog>
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
