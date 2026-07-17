"use client";

/**
 * Browser Notification API helpers — deliberately minimal. Permission is
 * only ever requested from an explicit user click (`requestPermission()`
 * below is never called on page load anywhere in this codebase — see
 * `NotificationPermissionSection.tsx`, the only caller). Web Push (background
 * delivery while the app/tab is closed) is NOT implemented in Checkpoint 4 —
 * see `docs/checkpoint-4/reminders-and-notifications.md` for why and what a
 * future scheduler-backed deployment would need.
 */

export function isBrowserNotificationSupported(): boolean {
  return typeof window !== "undefined" && "Notification" in window;
}

export function getBrowserNotificationPermission(): NotificationPermission | "unsupported" {
  if (!isBrowserNotificationSupported()) return "unsupported";
  return Notification.permission;
}

/** Must only be called synchronously from a user-initiated click handler — browsers reject/ignore the prompt otherwise. */
export async function requestBrowserNotificationPermission(): Promise<NotificationPermission | "unsupported"> {
  if (!isBrowserNotificationSupported()) return "unsupported";
  try {
    return await Notification.requestPermission();
  } catch {
    return "denied";
  }
}

/**
 * Shows a notification only if permission is already granted — never a
 * private note or checklist text, only a title/opportunity reference. Fails
 * silently (never throws) when unsupported, denied, or the browser blocks it
 * for any other reason.
 */
export function showBrowserNotification(title: string, body?: string): void {
  if (getBrowserNotificationPermission() !== "granted") return;
  try {
    new Notification(title, { body, icon: "/icon-192.png" });
  } catch {
    // Some browsers (mobile Safari, some Android WebViews) throw even when
    // permission is "granted" — never let a notification failure break the app.
  }
}
