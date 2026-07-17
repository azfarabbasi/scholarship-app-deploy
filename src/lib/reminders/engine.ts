/**
 * Deterministic reminder generation — pure, no DB/network access, reusable
 * from both the guest client hook and a future cloud batch job. Never
 * invents a date: an official-deadline reminder is only ever generated for
 * an exact, verified, single-occurrence deadline; every other precision
 * (unknown/rolling/estimated/program-specific/institution-specific, or any
 * opportunity with multiple candidate deadlines) is skipped entirely unless
 * the student has set their own personal deadline, which is always honoured
 * regardless of the official deadline's precision — it's their own data.
 */

export interface ReminderSourceItem {
  targetType: "built-in" | "custom";
  targetId: string;
  title: string;
  /** Present only when a single, exact, verified deadline date is known. */
  officialExactDeadline: string | null;
  personalDeadline: string | null;
}

export interface ReminderCandidate {
  stableKey: string;
  source: "official-deadline" | "personal-deadline";
  targetType: "built-in" | "custom";
  targetId: string;
  title: string;
  dueAt: string;
  leadDays: number;
}

function reminderDate(dueIso: string, leadDays: number): Date {
  const due = new Date(dueIso);
  const reminderAt = new Date(due);
  reminderAt.setUTCDate(reminderAt.getUTCDate() - leadDays);
  return reminderAt;
}

export function generateReminderCandidates(
  items: readonly ReminderSourceItem[],
  preferences: { officialLeadDays: readonly number[]; personalLeadDays: readonly number[] },
  now: Date,
): ReminderCandidate[] {
  const candidates: ReminderCandidate[] = [];

  for (const item of items) {
    if (item.officialExactDeadline) {
      for (const leadDays of preferences.officialLeadDays) {
        const remindAt = reminderDate(item.officialExactDeadline, leadDays);
        if (remindAt.getTime() < now.getTime() - 24 * 60 * 60 * 1000) continue; // don't backfill long-past reminder windows
        candidates.push({
          stableKey: `official-deadline:${item.targetId}:${item.officialExactDeadline}:${leadDays}`,
          source: "official-deadline",
          targetType: item.targetType,
          targetId: item.targetId,
          title: `Official deadline for "${item.title}"`,
          dueAt: item.officialExactDeadline,
          leadDays,
        });
      }
    }

    if (item.personalDeadline) {
      for (const leadDays of preferences.personalLeadDays) {
        const remindAt = reminderDate(item.personalDeadline, leadDays);
        if (remindAt.getTime() < now.getTime() - 24 * 60 * 60 * 1000) continue;
        candidates.push({
          stableKey: `personal-deadline:${item.targetType}:${item.targetId}:${item.personalDeadline}:${leadDays}`,
          source: "personal-deadline",
          targetType: item.targetType,
          targetId: item.targetId,
          title: `Your personal deadline for "${item.title}"`,
          dueAt: item.personalDeadline,
          leadDays,
        });
      }
    }
  }

  return candidates;
}
