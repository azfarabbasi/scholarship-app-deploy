"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { acceptReviewAssignment } from "@/lib/db/actions/reviews";

export function AcceptAssignmentButton({ assignmentId }: { assignmentId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  return (
    <Button
      size="sm"
      variant="outline"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        await acceptReviewAssignment(assignmentId);
        setBusy(false);
        router.refresh();
      }}
    >
      Accept
    </Button>
  );
}
