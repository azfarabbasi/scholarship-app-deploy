"use client";

import { useNow } from "@/hooks/useNow";

export function CurrentDate() {
  const now = useNow();

  if (!now) {
    return <span className="text-sm text-foreground-muted">Loading today&rsquo;s date…</span>;
  }

  const isoDate = now.toISOString().slice(0, 10);
  const formatted = new Intl.DateTimeFormat("en-GB", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(now);

  return (
    <p className="text-sm text-foreground-muted">
      Today is <time dateTime={isoDate}>{formatted}</time>
    </p>
  );
}
