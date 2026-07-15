"use client";

import { WifiOff } from "lucide-react";
import { useEffect, useRef } from "react";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { useLiveAnnouncer } from "@/components/common/LiveAnnouncer";

export function OfflineBanner() {
  const isOnline = useOnlineStatus();
  const { announce } = useLiveAnnouncer();
  const previous = useRef(isOnline);

  useEffect(() => {
    if (previous.current !== isOnline) {
      announce(isOnline ? "Back online. Your data has kept working locally." : "You are offline. ScholarTrack keeps working with locally saved data.");
      previous.current = isOnline;
    }
  }, [isOnline, announce]);

  if (isOnline) {
    return null;
  }

  return (
    <div className="flex items-center justify-center gap-2 bg-warning-tint px-4 py-2 text-center text-sm font-medium text-warning">
      <WifiOff className="h-4 w-4 shrink-0" aria-hidden="true" />
      <span>You&rsquo;re offline. ScholarTrack still works — the catalogue and your saved data are available locally.</span>
    </div>
  );
}
