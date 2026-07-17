"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { rebuildSearchIndex } from "@/lib/db/actions/discovery-quality";

export function RebuildSearchIndexButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  return (
    <div className="flex items-center gap-3">
      <Button
        size="sm"
        variant="outline"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          const result = await rebuildSearchIndex();
          setBusy(false);
          setMessage(
            result.ok
              ? `Done — pg_trgm is currently ${result.trgmAvailable ? "available" : "unavailable"} on this database.`
              : (result.error ?? "Failed."),
          );
          router.refresh();
        }}
      >
        {busy ? "Refreshing…" : "Refresh search statistics"}
      </Button>
      {message ? <span className="text-sm text-foreground-muted">{message}</span> : null}
    </div>
  );
}
