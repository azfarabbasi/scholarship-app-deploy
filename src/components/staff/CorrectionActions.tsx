"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Field";
import { investigateCorrection, rejectCorrection, resolveCorrection } from "@/lib/db/actions/corrections";

export function CorrectionActions({ correctionReportId, status }: { correctionReportId: string; status: string }) {
  const router = useRouter();
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  async function run(fn: () => Promise<{ ok: boolean }>) {
    setBusy(true);
    await fn();
    setBusy(false);
    router.refresh();
  }

  if (status === "resolved" || status === "rejected" || status === "closed") {
    return <span className="text-xs text-foreground-muted">No further action</span>;
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-2">
        {status === "submitted" || status === "triaged" || status === "assigned" ? (
          <Button size="sm" variant="outline" disabled={busy} onClick={() => run(() => investigateCorrection(correctionReportId))}>
            Start investigating
          </Button>
        ) : null}
      </div>
      <Input placeholder="Resolution note" value={note} onChange={(e) => setNote(e.target.value)} className="max-w-xs" />
      <div className="flex gap-2">
        <Button
          size="sm"
          disabled={busy || !note}
          onClick={() => run(() => resolveCorrection(correctionReportId, note))}
        >
          Resolve
        </Button>
        <Button
          size="sm"
          variant="danger"
          disabled={busy || !note}
          onClick={() => run(() => rejectCorrection(correctionReportId, note))}
        >
          Reject
        </Button>
      </div>
    </div>
  );
}
