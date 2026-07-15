/**
 * Calendar-day arithmetic helpers used by the deadline engine.
 *
 * These intentionally avoid millisecond-based day division (23-/25-hour DST
 * days would corrupt the count) and avoid substituting a server/browser
 * timezone for a missing source timezone.
 */

const STRICT_ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

export function isValidIsoDate(value: string | null | undefined): value is string {
  if (!value) {
    return false;
  }

  const match = STRICT_ISO_DATE.exec(value);
  if (!match) {
    return false;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);

  if (month < 1 || month > 12 || day < 1) {
    return false;
  }

  const isLeapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const daysInMonth = [31, isLeapYear ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

  return day <= daysInMonth[month - 1];
}

/** Proleptic-Gregorian ordinal day number; immune to DST/instant arithmetic bugs. */
function toOrdinalDay(isoDate: string): number {
  const [year, month, day] = isoDate.split("-").map(Number);
  const a = Math.floor((14 - month) / 12);
  const y = year + 4800 - a;
  const m = month + 12 * a - 3;
  return (
    day +
    Math.floor((153 * m + 2) / 5) +
    365 * y +
    Math.floor(y / 4) -
    Math.floor(y / 100) +
    Math.floor(y / 400) -
    32045
  );
}

/** Number of calendar days from `fromIsoDate` to `toIsoDate` (positive = future). */
export function daysBetweenIsoDates(fromIsoDate: string, toIsoDate: string): number {
  return toOrdinalDay(toIsoDate) - toOrdinalDay(fromIsoDate);
}

export function compareIsoDates(a: string, b: string): number {
  if (a === b) {
    return 0;
  }
  return a < b ? -1 : 1;
}

/** The current calendar date (YYYY-MM-DD) in a given IANA timezone. */
export function calendarDateInTimeZone(instant: Date, timeZone: string): string {
  try {
    const formatter = new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    return formatter.format(instant);
  } catch {
    return instant.toISOString().slice(0, 10);
  }
}

/** Best-effort calendar date when no source timezone is known. Never treated as authoritative. */
export function viewerCalendarDate(instant: Date): string {
  return instant.toISOString().slice(0, 10);
}
