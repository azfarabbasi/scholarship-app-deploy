export interface ReminderLike {
  dueAt: string;
  leadDays: number;
  status: "pending" | "dismissed" | "completed";
}

/** A reminder is "active" (worth showing/notifying about) once now has reached dueAt minus its lead time. */
export function isReminderActive(reminder: ReminderLike, now: Date): boolean {
  if (reminder.status !== "pending") return false;
  const remindAt = new Date(reminder.dueAt);
  remindAt.setUTCDate(remindAt.getUTCDate() - reminder.leadDays);
  return now.getTime() >= remindAt.getTime();
}

export function isReminderOverdue(reminder: ReminderLike, now: Date): boolean {
  return isReminderActive(reminder, now) && new Date(reminder.dueAt).getTime() < now.getTime();
}
