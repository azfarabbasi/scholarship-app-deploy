"use client";

import { useEffect, useState } from "react";

const RECOMPUTE_INTERVAL_MS = 60_000;

/**
 * Returns the current instant, recomputed on mount, when the tab becomes
 * visible again, on window focus, and periodically. Returns `null` until the
 * first client-side tick so server-rendered markup never bakes in a stale
 * build-time date (deadline-intelligence-spec.md: "Do not depend on a stale
 * build date").
 */
export function useNow(): Date | null {
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    const tick = () => setNow(new Date());
    tick();

    const interval = window.setInterval(tick, RECOMPUTE_INTERVAL_MS);
    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        tick();
      }
    };

    document.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("focus", tick);
    window.addEventListener("online", tick);

    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("focus", tick);
      window.removeEventListener("online", tick);
    };
  }, []);

  return now;
}
