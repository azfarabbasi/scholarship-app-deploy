"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import {
  activateEligibilityRule,
  publishDocumentRequirement,
  publishFundingBenefit,
} from "@/lib/db/actions/opportunity-relations";

type RelationKind = "funding-benefit" | "eligibility-rule" | "document-requirement";

const ACTIONS: Record<RelationKind, (opportunityId: string, id: string) => Promise<{ ok: boolean }>> = {
  "funding-benefit": publishFundingBenefit,
  "eligibility-rule": activateEligibilityRule,
  "document-requirement": publishDocumentRequirement,
};

const LABELS: Record<RelationKind, string> = {
  "funding-benefit": "Publish",
  "eligibility-rule": "Activate",
  "document-requirement": "Publish",
};

/** Shown next to a draft-status child record so a reviewer can promote it to public visibility. */
export function PromoteRelationButton({ opportunityId, relationId, kind }: { opportunityId: string; relationId: string; kind: RelationKind }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  return (
    <Button
      size="sm"
      variant="outline"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        await ACTIONS[kind](opportunityId, relationId);
        setBusy(false);
        router.refresh();
      }}
    >
      {LABELS[kind]}
    </Button>
  );
}
