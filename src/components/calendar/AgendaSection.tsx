"use client";

import { Download } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import type { CalendarEvent } from "@/lib/calendar/events";
import { buildSingleEventIcs } from "@/lib/calendar/ics";
import { downloadTextFile } from "@/lib/download";
import { EventSourceBadge } from "./EventBadge";

export function AgendaSection({
  title,
  events,
  emptyText,
  emphasis,
}: {
  title: string;
  events: CalendarEvent[];
  emptyText: string;
  /** Tints the count badge red when this section highlights something overdue/urgent, in addition to the text label — never color alone. */
  emphasis?: "danger";
}) {
  return (
    <section>
      <div className="flex items-center gap-2">
        <h2 className="text-base font-semibold text-foreground">{title}</h2>
        {events.length > 0 ? <Badge tone={emphasis === "danger" ? "red" : "neutral"}>{events.length}</Badge> : null}
      </div>
      {events.length === 0 ? (
        <p className="mt-2 text-sm text-foreground-muted">{emptyText}</p>
      ) : (
        <ul className="mt-2 flex flex-col gap-2">
          {events.map((event) => (
            <li
              key={event.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border p-3"
            >
              <div className="min-w-0">
                <Link
                  href={`/opportunities/${event.opportunitySlug}`}
                  className="font-medium text-foreground hover:underline"
                >
                  {event.title}
                </Link>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-foreground-muted">
                  <time dateTime={event.date}>{event.date}</time>
                  <EventSourceBadge source={event.source} />
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() =>
                  downloadTextFile(
                    `${event.opportunitySlug}-${event.date}.ics`,
                    buildSingleEventIcs(event),
                    "text/calendar",
                  )
                }
              >
                <Download className="h-3.5 w-3.5" aria-hidden="true" />
                .ics
              </Button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
