/**
 * Personal deadlines are a student's own reminder, not an official deadline
 * source. They are deliberately evaluated separately from
 * `evaluateDeadline()`: no verification gate applies, but the result must
 * never be presented as an official catalogue fact
 * (deadline-intelligence-spec.md, "Source and conflict rules").
 */
import { daysBetweenIsoDates, isValidIsoDate, viewerCalendarDate } from "./calendar-math";

export type PersonalDeadlineState = "upcoming" | "due-today" | "overdue" | "invalid";

export interface PersonalDeadlineResult {
  state: PersonalDeadlineState;
  days: number | null;
  label: string;
}

export function evaluatePersonalDeadline(isoDate: string | null, now: Date): PersonalDeadlineResult | null {
  if (!isoDate) {
    return null;
  }

  if (!isValidIsoDate(isoDate)) {
    return { state: "invalid", days: null, label: "Invalid personal deadline date" };
  }

  const today = viewerCalendarDate(now);
  const daysDiff = daysBetweenIsoDates(today, isoDate);

  if (daysDiff === 0) {
    return { state: "due-today", days: 0, label: "Your personal deadline is today" };
  }

  if (daysDiff < 0) {
    const overdueDays = Math.abs(daysDiff);
    return {
      state: "overdue",
      days: overdueDays,
      label: `${overdueDays} day${overdueDays === 1 ? "" : "s"} overdue`,
    };
  }

  return {
    state: "upcoming",
    days: daysDiff,
    label: `${daysDiff} day${daysDiff === 1 ? "" : "s"} remaining`,
  };
}
