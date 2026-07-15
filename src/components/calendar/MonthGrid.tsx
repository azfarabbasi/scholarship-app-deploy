"use client";

import Link from "next/link";
import { useMemo } from "react";
import { cn } from "@/lib/cn";
import type { CalendarEvent } from "@/lib/calendar/events";

function daysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

const WEEKDAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export function MonthGrid({
  year,
  month,
  events,
  todayIso,
}: {
  year: number;
  month: number;
  events: readonly CalendarEvent[];
  todayIso: string;
}) {
  const eventsByDate = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    for (const event of events) {
      const list = map.get(event.date) ?? [];
      list.push(event);
      map.set(event.date, list);
    }
    return map;
  }, [events]);

  const firstWeekday = (new Date(year, month, 1).getDay() + 6) % 7;
  const totalDays = daysInMonth(year, month);
  const cells: (number | null)[] = [
    ...Array.from({ length: firstWeekday }, () => null),
    ...Array.from({ length: totalDays }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) {
    cells.push(null);
  }

  return (
    <div className="w-full overflow-hidden">
      <div className="grid grid-cols-7 gap-1 text-center text-xs font-medium text-foreground-subtle">
        {WEEKDAY_LABELS.map((label) => (
          <div key={label}>{label}</div>
        ))}
      </div>
      <div className="mt-1 grid grid-cols-7 gap-1">
        {cells.map((day, index) => {
          if (day === null) {
            return <div key={`blank-${index}`} />;
          }
          const iso = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
          const dayEvents = eventsByDate.get(iso) ?? [];
          const isToday = iso === todayIso;

          return (
            <div
              key={iso}
              className={cn(
                "min-h-16 rounded-md border border-border p-1 text-left",
                isToday && "border-brand bg-brand-tint",
              )}
            >
              <p className={cn("text-xs font-medium", isToday ? "text-brand" : "text-foreground-muted")}>
                <time dateTime={iso}>{day}</time>
              </p>
              <div className="mt-0.5 flex flex-col gap-0.5">
                {dayEvents.slice(0, 2).map((event) => (
                  <Link
                    key={event.id}
                    href={`/opportunities/${event.opportunitySlug}`}
                    title={event.title}
                    className="block truncate rounded bg-surface-muted px-1 text-[10px] leading-tight text-foreground hover:underline"
                  >
                    {event.title}
                  </Link>
                ))}
                {dayEvents.length > 2 ? (
                  <span className="text-[10px] text-foreground-subtle">+{dayEvents.length - 2} more</span>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
