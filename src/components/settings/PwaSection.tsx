"use client";

import { CheckCircle2, Download } from "lucide-react";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { usePwaInstall } from "@/hooks/usePwaInstall";

export function PwaSection() {
  const { canInstall, installed, showIosGuidance, promptInstall } = usePwaInstall();

  if (installed) {
    return (
      <p className="flex items-center gap-2 text-sm text-foreground-muted">
        <CheckCircle2 className="h-4 w-4 text-success" aria-hidden="true" />
        ScholarTrack is installed as an app on this device.
      </p>
    );
  }

  if (canInstall) {
    return (
      <div className="flex flex-col gap-2">
        <p className="text-sm text-foreground-muted">
          Install ScholarTrack for quicker access and better offline support.
        </p>
        <Button size="sm" onClick={() => void promptInstall()} className="w-fit">
          <Download className="h-4 w-4" aria-hidden="true" /> Install app
        </Button>
      </div>
    );
  }

  if (showIosGuidance) {
    return (
      <Alert tone="info" title="Install on iOS Safari">
        Tap the Share icon, then &ldquo;Add to Home Screen&rdquo;. ScholarTrack will open like an app, with offline
        support for previously visited pages.
      </Alert>
    );
  }

  return (
    <p className="text-sm text-foreground-muted">
      Your browser doesn&rsquo;t currently offer an install prompt. You can still use ScholarTrack normally — it
      remains available offline after your first visit.
    </p>
  );
}
