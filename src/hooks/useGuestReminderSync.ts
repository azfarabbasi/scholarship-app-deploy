"use client";

import { useEffect } from "react";
import { useCatalogue } from "@/hooks/useCatalogue";
import { extractExactVerifiedDeadline } from "@/lib/reminders/extract";
import { generateReminderCandidates, type ReminderSourceItem } from "@/lib/reminders/engine";
import { getGuestReminderPreferences } from "@/lib/storage/reminders";
import { upsertGuestReminders } from "@/lib/storage/reminders";

/**
 * Regenerates guest reminders from the current catalogue + guest tracking
 * state. Deliberately triggered on mount (e.g. when `/notifications` or
 * `/workspace` renders), not on a background timer — matches the
 * "when user opens the app" cadence documented in
 * `docs/checkpoint-4/reminders-and-notifications.md`. Safe to call
 * repeatedly: `upsertGuestReminders` never overwrites a reminder the guest
 * already dismissed/completed.
 */
export function useGuestReminderSync(): void {
  const { items, loading } = useCatalogue();

  useEffect(() => {
    if (loading || items.length === 0) return;

    async function run() {
      const prefs = await getGuestReminderPreferences();
      if (!prefs.remindersEnabled) return;

      const sourceItems: ReminderSourceItem[] = items
        .map((item) => ({
          targetType: item.opportunity.kind,
          targetId: item.opportunity.id,
          title: item.opportunity.title,
          officialExactDeadline: item.opportunity.kind === "built-in" ? extractExactVerifiedDeadline(item.opportunity) : null,
          personalDeadline: item.workspace?.personalDeadline ?? null,
        }))
        .filter((item) => item.officialExactDeadline || item.personalDeadline);

      const candidates = generateReminderCandidates(
        sourceItems,
        prefs,
        new Date(),
      );
      await upsertGuestReminders(candidates);
    }

    void run();
  }, [items, loading]);
}
