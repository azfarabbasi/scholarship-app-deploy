/**
 * Minimal, standards-compliant (RFC 5545) .ics generation. No private notes
 * are ever threaded into a `CalendarEvent`, so exports cannot leak them.
 */
import type { CalendarEvent } from "./events";

function escapeIcsText(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

/** Folds a content line at 75 octets per RFC 5545 section 3.1. */
function foldLine(line: string): string {
  if (line.length <= 75) {
    return line;
  }
  const parts: string[] = [line.slice(0, 75)];
  let index = 75;
  while (index < line.length) {
    parts.push(line.slice(index, index + 74));
    index += 74;
  }
  return parts.join("\r\n ");
}

function toIcsDateStamp(isoDate: string): string {
  return isoDate.replace(/-/g, "");
}

function addOneCalendarDay(isoDate: string): string {
  const [year, month, day] = isoDate.split("-").map(Number);
  const next = new Date(Date.UTC(year, month - 1, day + 1));
  return next.toISOString().slice(0, 10);
}

function dtStamp(now: Date): string {
  return `${now.toISOString().replace(/[-:]/g, "").split(".")[0]}Z`;
}

export interface BuildIcsOptions {
  calendarName?: string;
  now?: Date;
}

export function buildIcsCalendar(events: readonly CalendarEvent[], options: BuildIcsOptions = {}): string {
  const now = options.now ?? new Date();
  const stamp = dtStamp(now);
  const lines: string[] = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//ScholarTrack//Checkpoint 1//EN", "CALSCALE:GREGORIAN"];

  if (options.calendarName) {
    lines.push(`X-WR-CALNAME:${escapeIcsText(options.calendarName)}`);
  }

  for (const event of events) {
    lines.push("BEGIN:VEVENT");
    lines.push(`UID:${event.id}@scholartrack.local`);
    lines.push(`DTSTAMP:${stamp}`);
    lines.push(`DTSTART;VALUE=DATE:${toIcsDateStamp(event.date)}`);
    lines.push(`DTEND;VALUE=DATE:${toIcsDateStamp(addOneCalendarDay(event.date))}`);
    lines.push(`SUMMARY:${escapeIcsText(event.title)}`);
    if (event.description) {
      lines.push(`DESCRIPTION:${escapeIcsText(event.description)}`);
    }
    if (event.officialUrl) {
      lines.push(`URL:${event.officialUrl}`);
    }
    lines.push("END:VEVENT");
  }

  lines.push("END:VCALENDAR");
  return lines.map(foldLine).join("\r\n") + "\r\n";
}

export function buildSingleEventIcs(event: CalendarEvent, options: BuildIcsOptions = {}): string {
  return buildIcsCalendar([event], options);
}
