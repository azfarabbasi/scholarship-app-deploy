"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import {
  acceptSourceEvidence,
  activateEligibilityRule,
  confirmOfficialSource,
  publishDocumentRequirement,
  publishFundingBenefit,
} from "@/lib/db/actions/opportunity-relations";
import { activateDeadlineCycle, activateDeadlineOccurrence, approveVerificationRecord } from "@/lib/db/actions/verification";

type RelationKind =
  | "funding-benefit"
  | "eligibility-rule"
  | "document-requirement"
  | "source-evidence"
  | "official-source"
  | "verification-record"
  | "deadline-cycle"
  | "deadline-occurrence";

const ACTIONS: Record<RelationKind, (opportunityId: string, id: string) => Promise<{ ok: boolean; error?: string }>> = {
  "funding-benefit": publishFundingBenefit,
  "eligibility-rule": activateEligibilityRule,
  "document-requirement": publishDocumentRequirement,
  "source-evidence": acceptSourceEvidence,
  // Confirms with "today" as the checked-at date — matches the same
  // one-click simplicity as every other promote action here. A reviewer who
  // needs to record a different checked date can still use the edit form.
  "official-source": (opportunityId, id) => confirmOfficialSource(opportunityId, id, new Date().toISOString().slice(0, 10)),
  "verification-record": approveVerificationRecord,
  "deadline-cycle": activateDeadlineCycle,
  "deadline-occurrence": activateDeadlineOccurrence,
};

const LABELS: Record<RelationKind, string> = {
  "funding-benefit": "Publish",
  "eligibility-rule": "Activate",
  "document-requirement": "Publish",
  "source-evidence": "Accept",
  "official-source": "Confirm as official",
  "verification-record": "Confirm",
  "deadline-cycle": "Activate",
  "deadline-occurrence": "Activate",
};

/**
 * Shown next to a draft-status child record so a reviewer can promote it to
 * public visibility. The underlying action rejects ordinary self-promotion;
 * only the verified bootstrap testing account may use the audited exception.
 * This button surfaces any rejection inline rather than silently failing.
 */
export function PromoteRelationButton({ opportunityId, relationId, kind }: { opportunityId: string; relationId: string; kind: RelationKind }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        size="sm"
        variant="outline"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setError(null);
          try {
            const result = await ACTIONS[kind](opportunityId, relationId);
            if (!result.ok) {
              setError(result.error ?? "Could not promote this record.");
              return;
            }
            router.refresh();
          } catch {
            setError("Could not promote this record. Check its status and linked evidence, then try again.");
          } finally {
            setBusy(false);
          }
        }}
      >
        {LABELS[kind]}
      </Button>
      {error ? (
        <Alert tone="danger" className="max-w-xs text-xs">
          {error}
        </Alert>
      ) : null}
    </div>
  );
}
