"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Bell, BellRing, Check, Clock, X } from "lucide-react";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/common/EmptyState";
import { useCatalogue } from "@/hooks/useCatalogue";
import { useGuestReminderSync } from "@/hooks/useGuestReminderSync";
import { filterOpportunities, DEFAULT_CATALOGUE_FILTERS, type CatalogueFilters } from "@/lib/catalogue/search";
import { diffSavedSearchResults } from "@/lib/discovery/saved-search-alerts";
import { isReminderActive, isReminderOverdue } from "@/lib/reminders/status";
import { showBrowserNotification } from "@/lib/notifications/browser";
import { subscribeToStorageChange } from "@/lib/storage/events";
import { NotificationPermissionSection } from "./NotificationPermissionSection";
import {
  deleteGuestReminder,
  getAllGuestReminders,
  setGuestReminderStatus,
} from "@/lib/storage/reminders";
import { getAllGuestSavedSearches, refreshGuestSavedSearchSnapshot } from "@/lib/storage/saved-searches";
import { getMyReminders, setMyReminderStatus, syncMyReminders, type ReminderRow } from "@/lib/db/actions/student/reminders";
import { getMySavedSearches, refreshMySavedSearchSnapshot } from "@/lib/db/actions/student/saved-searches";

interface NotificationCenterProps {
  studentProfileId: string | null;
}

interface NormalizedReminder {
  id: string;
  source: string;
  title: string;
  dueAt: string;
  leadDays: number;
  status: "pending" | "dismissed" | "completed";
}

function normalizeReminder(row: ReminderRow | Awaited<ReturnType<typeof getAllGuestReminders>>[number]): NormalizedReminder {
  return {
    id: row.id,
    source: row.source,
    title: row.title,
    dueAt: typeof row.dueAt === "string" ? row.dueAt : row.dueAt.toISOString(),
    leadDays: row.leadDays,
    status: row.status,
  };
}

export function NotificationCenter({ studentProfileId }: NotificationCenterProps) {
  const { items } = useCatalogue();
  useGuestReminderSync(); // no-op server-side path is handled separately below for signed-in users

  const [reminders, setReminders] = useState<NormalizedReminder[]>([]);
  const [alertMessages, setAlertMessages] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  async function refreshReminders() {
    const rows = studentProfileId ? await getMyReminders() : await getAllGuestReminders();
    setReminders(rows.map(normalizeReminder));
  }

  useEffect(() => {
    async function init() {
      if (studentProfileId) {
        await syncMyReminders();
      }
      await refreshReminders();
      setLoading(false);
    }
    void init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studentProfileId]);

  // Guest reminders are (re)generated asynchronously by `useGuestReminderSync()` above — a separate
  // hook whose own effect only resolves once `useCatalogue()` finishes loading, which can easily
  // land after the one-shot fetch in the effect above. Subscribing here (rather than relying on that
  // single fetch) is what actually picks up a freshly-generated reminder without a manual reload.
  useEffect(() => {
    if (studentProfileId) return undefined; // signed-in path already sequences sync + fetch above
    return subscribeToStorageChange("reminders", () => {
      void refreshReminders();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studentProfileId]);

  // Saved-search alert check — runs once the catalogue has loaded.
  useEffect(() => {
    if (items.length === 0) return;

    async function checkAlerts() {
      const searches = studentProfileId ? await getMySavedSearches() : await getAllGuestSavedSearches();
      const messages: string[] = [];

      for (const search of searches) {
        if (!search.alertsEnabled) continue;
        const filters: CatalogueFilters = { ...DEFAULT_CATALOGUE_FILTERS, ...(search.filters as Partial<CatalogueFilters>) };
        const currentIds = filterOpportunities(items, filters).map((i) => i.opportunity.id);
        const previousIds = (search.resultSnapshot as string[]) ?? [];
        const diff = diffSavedSearchResults(previousIds, currentIds);
        if (diff.hasAlert) {
          messages.push(`"${search.name}": ${diff.messages.join(" ")}`);
          if (studentProfileId) {
            await refreshMySavedSearchSnapshot(search.id, currentIds.length, currentIds);
          } else {
            await refreshGuestSavedSearchSnapshot(search.id, currentIds.length, currentIds);
          }
        }
      }

      setAlertMessages(messages);
    }

    void checkAlerts();
  }, [items, studentProfileId]);

  const now = useMemo(() => new Date(), []);
  const active = reminders.filter((r) => isReminderActive(r, now));
  const overdue = active.filter((r) => isReminderOverdue(r, now));
  const upcoming = active.filter((r) => !isReminderOverdue(r, now));
  const dismissed = reminders.filter((r) => r.status === "dismissed" || r.status === "completed");

  useEffect(() => {
    for (const reminder of overdue) {
      showBrowserNotification(`Overdue: ${reminder.title}`, `Due ${new Date(reminder.dueAt).toLocaleDateString()}`);
    }
    // Only fire once per load, not on every reminders-state change, to avoid re-notifying on every dismiss/complete click.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading]);

  async function handleDismiss(id: string) {
    if (studentProfileId) await setMyReminderStatus(id, "dismissed");
    else await setGuestReminderStatus(id, "dismissed");
    await refreshReminders();
  }
  async function handleComplete(id: string) {
    if (studentProfileId) await setMyReminderStatus(id, "completed");
    else await setGuestReminderStatus(id, "completed");
    await refreshReminders();
  }
  async function handleRemove(id: string) {
    if (studentProfileId) await setMyReminderStatus(id, "dismissed");
    else await deleteGuestReminder(id);
    await refreshReminders();
  }

  if (loading) return <p className="text-sm text-foreground-muted">Loading…</p>;

  return (
    <div className="flex flex-col gap-6">
      <NotificationPermissionSection />

      {alertMessages.length > 0 ? (
        <Alert tone="info" title="Saved-search alerts">
          <ul className="list-inside list-disc">
            {alertMessages.map((message, index) => (
              <li key={index}>{message}</li>
            ))}
          </ul>
        </Alert>
      ) : null}

      <section>
        <h2 className="flex items-center gap-2 text-base font-semibold text-foreground">
          <AlertTriangle className="h-4 w-4 text-danger" aria-hidden="true" /> Overdue ({overdue.length})
        </h2>
        {overdue.length === 0 ? (
          <p className="mt-1 text-sm text-foreground-muted">Nothing overdue.</p>
        ) : (
          <ul className="mt-2 flex flex-col gap-2">
            {overdue.map((reminder) => (
              <ReminderRowItem key={reminder.id} reminder={reminder} onDismiss={handleDismiss} onComplete={handleComplete} onRemove={handleRemove} />
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="flex items-center gap-2 text-base font-semibold text-foreground">
          <BellRing className="h-4 w-4 text-brand" aria-hidden="true" /> Upcoming ({upcoming.length})
        </h2>
        {upcoming.length === 0 ? (
          <EmptyState icon={<Bell className="h-6 w-6" />} title="No upcoming reminders" description="Reminders appear here once their lead time is reached." />
        ) : (
          <ul className="mt-2 flex flex-col gap-2">
            {upcoming.map((reminder) => (
              <ReminderRowItem key={reminder.id} reminder={reminder} onDismiss={handleDismiss} onComplete={handleComplete} onRemove={handleRemove} />
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="flex items-center gap-2 text-base font-semibold text-foreground">
          <Clock className="h-4 w-4 text-foreground-subtle" aria-hidden="true" /> Dismissed / completed ({dismissed.length})
        </h2>
        {dismissed.length > 0 ? (
          <ul className="mt-2 flex flex-col gap-1 text-sm text-foreground-muted">
            {dismissed.map((r) => (
              <li key={r.id}>
                {r.title} — {r.status}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-1 text-sm text-foreground-muted">None yet.</p>
        )}
      </section>
    </div>
  );
}

function ReminderRowItem({
  reminder,
  onDismiss,
  onComplete,
  onRemove,
}: {
  reminder: NormalizedReminder;
  onDismiss: (id: string) => void;
  onComplete: (id: string) => void;
  onRemove: (id: string) => void;
}) {
  return (
    <li className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border p-3">
      <div>
        <p className="text-sm font-medium text-foreground">{reminder.title}</p>
        <p className="text-xs text-foreground-muted">
          {reminder.source === "official-deadline" ? "Official deadline" : "Personal deadline"} · Due{" "}
          {new Date(reminder.dueAt).toLocaleDateString()}
        </p>
      </div>
      <div className="flex gap-2">
        <Button size="sm" variant="outline" onClick={() => onComplete(reminder.id)}>
          <Check className="h-3.5 w-3.5" aria-hidden="true" /> Complete
        </Button>
        <Button size="sm" variant="ghost" onClick={() => onDismiss(reminder.id)}>
          Dismiss
        </Button>
        <Button size="sm" variant="ghost" onClick={() => onRemove(reminder.id)} aria-label="Remove reminder">
          <X className="h-3.5 w-3.5" aria-hidden="true" />
        </Button>
      </div>
    </li>
  );
}
