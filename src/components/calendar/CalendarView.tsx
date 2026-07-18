"use client";

import { ChevronLeft, ChevronRight, Download } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/Field";
import { Skeleton } from "@/components/ui/Skeleton";
import { useCatalogue } from "@/hooks/useCatalogue";
import { deriveCalendarEvents, type CalendarEventSource } from "@/lib/calendar/events";
import { buildIcsCalendar } from "@/lib/calendar/ics";
import { downloadTextFile } from "@/lib/download";
import type { WorkspaceRecord } from "@/lib/storage/types";
import { AgendaSection } from "./AgendaSection";
import { MonthGrid } from "./MonthGrid";
import { UndatedList } from "./UndatedList";

const SOURCE_OPTIONS: { value: CalendarEventSource; label: string }[] = [
  { value: "official", label: "Official (verified)" },
  { value: "personal", label: "Personal reminders" },
  { value: "custom", label: "Custom opportunities" },
];

export function CalendarView() {
  const { items, now, loading } = useCatalogue();
  const [mode, setMode] = useState<"month" | "agenda">("agenda");
  const [visibleSources, setVisibleSources] = useState<CalendarEventSource[]>(["official", "personal", "custom"]);
  const [shortlistedOnly, setShortlistedOnly] = useState(false);
  const [offset, setOffset] = useState(0);

  const opportunities = useMemo(() => items.map((item) => item.opportunity), [items]);
  const workspaceRecords = useMemo(
    () => items.map((item) => item.workspace).filter((record): record is WorkspaceRecord => record !== null),
    [items],
  );

  const derivation = useMemo(() => {
    if (!now) return { dated: [], undated: [] };
    return deriveCalendarEvents(opportunities, workspaceRecords, now);
  }, [opportunities, workspaceRecords, now]);

  const shortlistedIds = useMemo(
    () => new Set(items.filter((item) => item.workspace?.shortlisted).map((item) => item.opportunity.id)),
    [items],
  );

  const filteredDated = useMemo(
    () =>
      derivation.dated.filter(
        (event) =>
          visibleSources.includes(event.source) && (!shortlistedOnly || shortlistedIds.has(event.opportunityId)),
      ),
    [derivation.dated, visibleSources, shortlistedOnly, shortlistedIds],
  );

  const filteredUndated = useMemo(
    () => derivation.undated.filter((entry) => !shortlistedOnly || shortlistedIds.has(entry.opportunityId)),
    [derivation.undated, shortlistedOnly, shortlistedIds],
  );

  if (loading || !now) {
    return <Skeleton className="h-96 w-full" />;
  }

  const todayIso = now.toISOString().slice(0, 10);
  const overdue = filteredDated.filter((event) => event.source === "personal" && event.date < todayIso);
  const upcoming = filteredDated.filter((event) => !(event.source === "personal" && event.date < todayIso));

  const viewMonth = new Date(now.getFullYear(), now.getMonth() + offset, 1);

  function toggleSource(source: CalendarEventSource) {
    setVisibleSources((prev) => (prev.includes(source) ? prev.filter((s) => s !== source) : [...prev, source]));
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div role="group" aria-label="Calendar view" className="inline-flex rounded-md border border-border">
          <button
            type="button"
            aria-pressed={mode === "agenda"}
            onClick={() => setMode("agenda")}
            className={`rounded-l-md px-3 py-2 text-sm font-medium ${mode === "agenda" ? "bg-brand-tint text-brand" : "text-foreground-muted hover:bg-surface-muted"}`}
          >
            Agenda
          </button>
          <button
            type="button"
            aria-pressed={mode === "month"}
            onClick={() => setMode("month")}
            className={`rounded-r-md border-l border-border px-3 py-2 text-sm font-medium ${mode === "month" ? "bg-brand-tint text-brand" : "text-foreground-muted hover:bg-surface-muted"}`}
          >
            Month
          </button>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={() =>
            downloadTextFile(
              "scholartrack-upcoming-deadlines.ics",
              buildIcsCalendar(upcoming, { calendarName: "ScholarTrack deadlines", now }),
              "text/calendar",
            )
          }
        >
          <Download className="h-4 w-4" aria-hidden="true" /> Export all upcoming (.ics)
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg border border-border bg-surface p-3">
        <span className="text-sm font-medium text-foreground-muted">Show:</span>
        {SOURCE_OPTIONS.map((option) => (
          <Checkbox
            key={option.value}
            id={`calendar-source-${option.value}`}
            label={option.label}
            checked={visibleSources.includes(option.value)}
            onChange={() => toggleSource(option.value)}
          />
        ))}
        <Checkbox
          id="calendar-shortlisted-only"
          label="Shortlisted only"
          checked={shortlistedOnly}
          onChange={(e) => setShortlistedOnly(e.target.checked)}
        />
      </div>

      {mode === "month" ? (
        <div>
          <div className="mb-3 flex items-center justify-between">
            <Button variant="ghost" size="sm" onClick={() => setOffset((o) => o - 1)} aria-label="Previous month">
              <ChevronLeft className="h-4 w-4" aria-hidden="true" />
            </Button>
            <p className="text-sm font-semibold text-foreground">
              {new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric" }).format(viewMonth)}
            </p>
            <Button variant="ghost" size="sm" onClick={() => setOffset((o) => o + 1)} aria-label="Next month">
              <ChevronRight className="h-4 w-4" aria-hidden="true" />
            </Button>
          </div>
          <MonthGrid
            year={viewMonth.getFullYear()}
            month={viewMonth.getMonth()}
            events={filteredDated}
            todayIso={todayIso}
          />
        </div>
      ) : (
        <div className="flex flex-col gap-8">
          <AgendaSection
            title="Overdue personal deadlines"
            events={overdue}
            emptyText="No overdue personal deadlines."
            emphasis="danger"
          />
          <AgendaSection title="Upcoming" events={upcoming} emptyText="No upcoming dated deadlines to show." />
          <UndatedList entries={filteredUndated} />
        </div>
      )}
    </div>
  );
}
