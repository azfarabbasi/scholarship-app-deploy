"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { useLiveAnnouncer } from "@/components/common/LiveAnnouncer";

export function ServiceWorkerRegistration() {
  const [waitingWorker, setWaitingWorker] = useState<ServiceWorker | null>(null);
  const { announce } = useLiveAnnouncer();
  const userRequestedRefresh = useRef(false);

  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) {
      return;
    }

    let hasReloaded = false;
    // `clients.claim()` in sw.js also fires `controllerchange` the very
    // first time a service worker takes control of an until-then-uncontrolled
    // page (i.e. on a visitor's first-ever visit, not just on updates).
    // Reloading unconditionally here would silently refresh (and could
    // interrupt) every first-time visitor a moment after they land. Only
    // reload when the user explicitly asked for the new version via the
    // "Refresh" button below.
    const handleControllerChange = () => {
      if (!userRequestedRefresh.current || hasReloaded) return;
      hasReloaded = true;
      window.location.reload();
    };
    navigator.serviceWorker.addEventListener("controllerchange", handleControllerChange);

    navigator.serviceWorker
      .register("/sw.js")
      .then((registration) => {
        if (registration.waiting && navigator.serviceWorker.controller) {
          setWaitingWorker(registration.waiting);
          announce("An update to ScholarTrack is available.");
        }

        registration.addEventListener("updatefound", () => {
          const installing = registration.installing;
          if (!installing) return;
          installing.addEventListener("statechange", () => {
            if (installing.state === "installed" && navigator.serviceWorker.controller) {
              setWaitingWorker(installing);
              announce("An update to ScholarTrack is available.");
            }
          });
        });
      })
      .catch(() => {
        // Registration failures are non-fatal; the app still works online.
      });

    return () => {
      navigator.serviceWorker.removeEventListener("controllerchange", handleControllerChange);
    };
  }, [announce]);

  if (!waitingWorker) {
    return null;
  }

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 flex justify-center p-4">
      <div className="flex items-center gap-3 rounded-lg border border-border bg-surface px-4 py-3 shadow-lg">
        <p className="text-sm text-foreground">A new version of ScholarTrack is available.</p>
        <Button
          size="sm"
          onClick={() => {
            userRequestedRefresh.current = true;
            waitingWorker.postMessage({ type: "SKIP_WAITING" });
          }}
        >
          Refresh
        </Button>
      </div>
    </div>
  );
}
