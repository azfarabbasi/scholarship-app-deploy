import Link from "next/link";
import type { UndatedCalendarEntry } from "@/lib/calendar/events";

export function UndatedList({ entries }: { entries: UndatedCalendarEntry[] }) {
  return (
    <section>
      <h2 className="text-base font-semibold text-foreground">Needs verification or undated</h2>
      {entries.length === 0 ? (
        <p className="mt-2 text-sm text-foreground-muted">Nothing here right now.</p>
      ) : (
        <ul className="mt-2 flex flex-col gap-2">
          {entries.map((entry) => (
            <li
              key={entry.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border p-3"
            >
              <Link
                href={`/opportunities/${entry.opportunitySlug}`}
                className="font-medium text-foreground hover:underline"
              >
                {entry.title}
              </Link>
              <span className="text-xs text-foreground-muted">{entry.reason}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
