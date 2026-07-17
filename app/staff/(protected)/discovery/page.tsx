import Link from "next/link";
import { getDiscoveryQualityReport, type DiscoveryQualityItem } from "@/lib/db/actions/discovery-quality";
import { RebuildSearchIndexButton } from "@/components/staff/RebuildSearchIndexButton";

function QueueSection({
  title,
  description,
  items,
}: {
  title: string;
  description: string;
  items: readonly DiscoveryQualityItem[];
}) {
  return (
    <div className="rounded-lg border border-border p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-sm font-semibold text-foreground">{title}</h2>
        <span className="text-xs text-foreground-muted">{items.length} opportunit{items.length === 1 ? "y" : "ies"}</span>
      </div>
      <p className="mt-1 text-xs text-foreground-muted">{description}</p>
      {items.length === 0 ? (
        <p className="mt-3 text-sm text-foreground-muted">None — every published opportunity clears this check.</p>
      ) : (
        <ul className="mt-3 flex flex-col gap-1">
          {items.slice(0, 25).map((item) => (
            <li key={item.id} className="text-sm">
              <Link href={`/staff/opportunities/${item.id}`} className="text-foreground hover:underline">
                {item.title}
              </Link>
            </li>
          ))}
          {items.length > 25 ? (
            <li className="text-xs text-foreground-muted">…and {items.length - 25} more.</li>
          ) : null}
        </ul>
      )}
    </div>
  );
}

export default async function StaffDiscoveryQualityPage() {
  const report = await getDiscoveryQualityReport();

  if (!report) {
    return (
      <div className="flex flex-col gap-2">
        <h1 className="text-xl font-semibold text-foreground">Discovery quality</h1>
        <p className="text-sm text-foreground-muted">You don&rsquo;t have permission to view this page.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-foreground">Discovery quality</h1>
        <p className="mt-1 text-sm text-foreground-muted">
          Support tooling for the student-facing search, matching, and reminders features (Checkpoint 4). Every queue
          below is scoped to the {report.totalPublished} currently-published opportunit
          {report.totalPublished === 1 ? "y" : "ies"} — exactly what students can discover today.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <QueueSection
          title="Stale verification"
          description="Verification status is “stale” — the last check is no longer considered current."
          items={report.staleVerification}
        />
        <QueueSection
          title="Missing eligibility rules"
          description="No structured eligibility rule is attached, so the matching engine can only report “missing information” for these."
          items={report.missingEligibilityRules}
        />
        <QueueSection
          title="Missing required documents"
          description="No document requirement is recorded, so students can&rsquo;t see what to prepare."
          items={report.missingRequiredDocuments}
        />
        <QueueSection
          title="Missing searchable taxonomy"
          description="No country, region, or study level is set — these opportunities are invisible to every facet filter."
          items={report.missingTaxonomy}
        />
        <QueueSection
          title="No official deadline clarity"
          description="Deadline isn&rsquo;t both exact and verified with a single occurrence, so no official-deadline reminder can ever be scheduled for it."
          items={report.unclearOfficialDeadline}
        />
      </div>

      <div className="rounded-lg border border-border p-4">
        <h2 className="text-sm font-semibold text-foreground">Saved-search alert diagnostics</h2>
        <p className="mt-1 text-xs text-foreground-muted">
          Aggregate counts only — staff have no default access to any individual student&rsquo;s saved search name,
          query, or filters (see the ownership-only RLS policy on <code>user_saved_searches</code>). The alert-check
          itself runs deterministically on the client whenever a student opens their saved searches or the app,
          diffing the current result set against the last snapshot — there is no server-side push.
        </p>
        <dl className="mt-3 grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
          <div>
            <dt className="text-xs text-foreground-muted">Total saved searches</dt>
            <dd className="font-semibold text-foreground">{report.savedSearchStats.total}</dd>
          </div>
          <div>
            <dt className="text-xs text-foreground-muted">Alerts enabled</dt>
            <dd className="font-semibold text-foreground">{report.savedSearchStats.alertsEnabled}</dd>
          </div>
          <div>
            <dt className="text-xs text-foreground-muted">Never checked</dt>
            <dd className="font-semibold text-foreground">{report.savedSearchStats.neverChecked}</dd>
          </div>
        </dl>
      </div>

      <div className="rounded-lg border border-border p-4">
        <h2 className="text-sm font-semibold text-foreground">Reminder dispatch diagnostics</h2>
        <p className="mt-1 text-xs text-foreground-muted">
          Aggregate counts only, same boundary as above. Reminders are generated deterministically (never invented)
          from official exact-verified deadlines and personal deadlines, and are only ever surfaced back to the
          student who owns them — there is no server-side email/SMS/push dispatch to diagnose here.
        </p>
        <dl className="mt-3 grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
          <div>
            <dt className="text-xs text-foreground-muted">Total reminders</dt>
            <dd className="font-semibold text-foreground">{report.reminderStats.total}</dd>
          </div>
          <div>
            <dt className="text-xs text-foreground-muted">Pending</dt>
            <dd className="font-semibold text-foreground">{report.reminderStats.pending}</dd>
          </div>
          <div>
            <dt className="text-xs text-foreground-muted">Overdue &amp; pending</dt>
            <dd className="font-semibold text-danger">{report.reminderStats.overduePending}</dd>
          </div>
          <div>
            <dt className="text-xs text-foreground-muted">Dismissed</dt>
            <dd className="font-semibold text-foreground">{report.reminderStats.dismissed}</dd>
          </div>
          <div>
            <dt className="text-xs text-foreground-muted">Completed</dt>
            <dd className="font-semibold text-foreground">{report.reminderStats.completed}</dd>
          </div>
          <div>
            <dt className="text-xs text-foreground-muted">Unread notifications</dt>
            <dd className="font-semibold text-foreground">
              {report.notificationStats.unread} / {report.notificationStats.total}
            </dd>
          </div>
        </dl>
      </div>

      <div className="rounded-lg border border-border p-4">
        <h2 className="text-sm font-semibold text-foreground">Search index</h2>
        <p className="mt-1 text-xs text-foreground-muted">
          There is no separate app-managed search index — ranking is computed live per request. This refreshes
          Postgres&rsquo; planner statistics for the catalogue tables and re-checks whether the <code>pg_trgm</code>{" "}
          extension is installed (it&rsquo;s created best-effort at migration time; some hosting environments don&rsquo;t
          allow it, in which case search falls back to plain substring/typo matching automatically).
        </p>
        <p className="mt-2 text-sm">
          <code>pg_trgm</code> is currently{" "}
          <span className={report.trgmAvailable ? "font-medium text-success" : "font-medium text-foreground-muted"}>
            {report.trgmAvailable ? "available" : "unavailable (using the JS fallback)"}
          </span>
          .
        </p>
        <div className="mt-3">
          <RebuildSearchIndexButton />
        </div>
      </div>
    </div>
  );
}
