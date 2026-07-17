"use client";

import { useEffect, useState } from "react";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { getPublicEnv } from "@/lib/env";
import {
  getBrowserNotificationPermission,
  isBrowserNotificationSupported,
  requestBrowserNotificationPermission,
} from "@/lib/notifications/browser";

export function NotificationPermissionSection() {
  const [permission, setPermission] = useState<NotificationPermission | "unsupported">("unsupported");

  useEffect(() => {
    // `Notification.permission` doesn't exist during SSR, so it can't be read
    // as the initial state — this one-time sync from that browser-only API
    // to React state (there's no change event to subscribe to instead) is
    // exactly the case this rule can't distinguish from a real anti-pattern.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPermission(getBrowserNotificationPermission());
  }, []);

  if (!getPublicEnv().NEXT_PUBLIC_ENABLE_BROWSER_NOTIFICATIONS) {
    return null;
  }

  if (!isBrowserNotificationSupported()) {
    return (
      <Alert tone="info" title="Browser notifications aren't supported here">
        Your browser doesn&rsquo;t support notifications, or they&rsquo;re unavailable in this context. The
        notification center below still works normally.
      </Alert>
    );
  }

  if (permission === "granted") {
    return (
      <Alert tone="success" title="Browser notifications are on">
        You&rsquo;ll get a browser notification for reminders while this app is open. This never includes your notes
        or checklist text — only a reminder title.
      </Alert>
    );
  }

  if (permission === "denied") {
    return (
      <Alert tone="warning" title="Browser notifications are blocked">
        You previously denied this, or your browser settings block it. You can still see everything in the
        notification center below — re-enable notifications from your browser&rsquo;s site settings if you change
        your mind.
      </Alert>
    );
  }

  return (
    <Alert tone="info" title="Turn on browser notifications?">
      <p>
        We&rsquo;ll only ask your browser to show a notification for a reminder while this app is open in a tab — not
        in the background when it&rsquo;s closed. Only a reminder title is ever shown, never note or checklist
        contents.
      </p>
      <Button
        size="sm"
        variant="outline"
        className="mt-2"
        onClick={() => {
          void requestBrowserNotificationPermission().then(setPermission);
        }}
      >
        Enable browser notifications
      </Button>
    </Alert>
  );
}
