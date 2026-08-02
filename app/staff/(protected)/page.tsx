import {
  ArrowRight,
  BadgeCheck,
  ClipboardCheck,
  Copy,
  FilePen,
  Globe2,
  Inbox,
  MessageSquareWarning,
  ShieldAlert,
  Undo2,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import { and, count, desc, eq, inArray } from "drizzle-orm";
import { getStaffSession } from "@/lib/auth/session";
import { getDb, schema } from "@/lib/db/client";
import { canViewFullAuditLog } from "@/lib/auth/permissions";

async function getDashboardCounts(staffProfileId: string) {
  const db = getDb();

  const [drafts, pendingReview, changesRequested, awaitingApproval, published, staleVerification, corrections, duplicates, myAssignments] =
    await Promise.all([
      db.select({ value: count() }).from(schema.opportunities).where(eq(schema.opportunities.status, "draft")),
      db.select({ value: count() }).from(schema.opportunities).where(eq(schema.opportunities.status, "in_review")),
      db.select({ value: count() }).from(schema.opportunities).where(eq(schema.opportunities.status, "changes_requested")),
      db.select({ value: count() }).from(schema.opportunities).where(eq(schema.opportunities.status, "reviewed")),
      db.select({ value: count() }).from(schema.opportunities).where(eq(schema.opportunities.status, "published")),
      db.select({ value: count() }).from(schema.opportunities).where(eq(schema.opportunities.overallVerificationStatus, "stale")),
      db
        .select({ value: count() })
        .from(schema.correctionReports)
        .where(inArray(schema.correctionReports.status, ["submitted", "triaged", "assigned", "investigating"])),
      db.select({ value: count() }).from(schema.duplicateCandidates).where(eq(schema.duplicateCandidates.status, "pending")),
      db
        .select({ value: count() })
        .from(schema.reviewAssignments)
        .where(
          and(
            eq(schema.reviewAssignments.reviewerStaffProfileId, staffProfileId),
            inArray(schema.reviewAssignments.status, ["assigned", "accepted", "in-review"]),
          ),
        ),
    ]);

  return {
    drafts: drafts[0].value,
    pendingReview: pendingReview[0].value,
    changesRequested: changesRequested[0].value,
    awaitingApproval: awaitingApproval[0].value,
    published: published[0].value,
    staleVerification: staleVerification[0].value,
    corrections: corrections[0].value,
    duplicates: duplicates[0].value,
    myAssignments: myAssignments[0].value,
  };
}

type CountKey = keyof Awaited<ReturnType<typeof getDashboardCounts>>;

interface DashboardCard {
  key: CountKey;
  label: string;
  hint: string;
  href: string;
  icon: LucideIcon;
}

/**
 * Split by "does a non-zero number here mean someone has to do something?".
 * The previous single grid rendered `published` (a healthy total that should
 * grow) identically to `corrections` (a backlog that should sit at zero), so
 * there was no way to read the queue at a glance.
 */
const QUEUE_CARDS: DashboardCard[] = [
  {
    key: "myAssignments",
    label: "My open reviews",
    hint: "Assigned to you and not yet completed",
    href: "/staff/reviews",
    icon: ClipboardCheck,
  },
  {
    key: "pendingReview",
    label: "Pending review",
    hint: "Submitted and waiting for a reviewer",
    href: "/staff/opportunities?status=in_review",
    icon: Inbox,
  },
  {
    key: "awaitingApproval",
    label: "Awaiting approval",
    hint: "Reviewed — needs a publish decision",
    href: "/staff/opportunities?status=reviewed",
    icon: BadgeCheck,
  },
  {
    key: "changesRequested",
    label: "Changes requested",
    hint: "Sent back to the author for edits",
    href: "/staff/opportunities?status=changes_requested",
    icon: Undo2,
  },
  {
    key: "corrections",
    label: "Open corrections",
    hint: "Reader-reported problems to triage",
    href: "/staff/corrections",
    icon: MessageSquareWarning,
  },
  {
    key: "duplicates",
    label: "Duplicate candidates",
    hint: "Pending merge-or-dismiss decisions",
    href: "/staff/duplicates",
    icon: Copy,
  },
  {
    key: "staleVerification",
    label: "Stale verification",
    hint: "Published but past its re-check window",
    href: "/staff/opportunities",
    icon: ShieldAlert,
  },
];

const CATALOGUE_CARDS: DashboardCard[] = [
  {
    key: "published",
    label: "Published",
    hint: "Live and visible to students",
    href: "/staff/opportunities?status=published",
    icon: Globe2,
  },
  {
    key: "drafts",
    label: "Drafts",
    hint: "Started but not yet submitted",
    href: "/staff/opportunities?status=draft",
    icon: FilePen,
  },
];

function QueueCard({ card, value }: { card: DashboardCard; value: number }) {
  const Icon = card.icon;
  const needsAttention = value > 0;

  return (
    <Link
      href={card.href}
      className="card-interactive group flex flex-col gap-3 rounded-lg border border-border bg-surface p-4 shadow-e1 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus-ring)]"
    >
      <div className="flex items-center justify-between gap-2">
        <span
          aria-hidden="true"
          className={
            needsAttention
              ? "flex h-9 w-9 items-center justify-center rounded-lg bg-warning-tint text-warning"
              : "flex h-9 w-9 items-center justify-center rounded-lg bg-surface-muted text-foreground-subtle"
          }
        >
          <Icon className="h-4 w-4" />
        </span>
        <span
          className={
            needsAttention
              ? "text-3xl font-semibold leading-none tracking-tight text-foreground"
              : "text-3xl font-semibold leading-none tracking-tight text-foreground-subtle"
          }
        >
          {value}
        </span>
      </div>
      <div>
        <p className="flex items-center gap-1.5 text-sm font-medium text-foreground">
          {card.label}
          <ArrowRight
            className="h-3.5 w-3.5 shrink-0 text-brand opacity-0 transition-opacity group-hover:opacity-100"
            aria-hidden="true"
          />
        </p>
        <p className="mt-0.5 text-xs leading-snug text-foreground-muted">{card.hint}</p>
      </div>
    </Link>
  );
}

export default async function StaffDashboardPage() {
  const session = await getStaffSession();
  if (!session) return null;

  const counts = await getDashboardCounts(session.staffProfileId);
  const db = getDb();
  const recentAudit = canViewFullAuditLog(session.roles)
    ? await db.select().from(schema.auditLog).orderBy(desc(schema.auditLog.occurredAt)).limit(10)
    : [];

  const openWork = QUEUE_CARDS.reduce((total, card) => total + counts[card.key], 0);

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Staff dashboard</h1>
          <p className="mt-1 text-sm text-foreground-muted">
            Signed in as <span className="font-medium text-foreground">{session.displayName}</span> ·{" "}
            {session.roles.join(", ")}
          </p>
        </div>
        <p
          className={
            openWork > 0
              ? "rounded-full border border-warning/30 bg-warning-tint px-3 py-1.5 text-sm font-medium text-foreground"
              : "rounded-full border border-success/30 bg-success-tint px-3 py-1.5 text-sm font-medium text-foreground"
          }
        >
          {openWork > 0 ? `${openWork} items need attention` : "No open items — all queues clear"}
        </p>
      </div>

      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wider text-foreground-subtle">Needs attention</h2>
        <p className="mt-1 text-sm text-foreground-muted">
          Each of these should trend toward zero. A grey tile means nothing is waiting.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {QUEUE_CARDS.map((card) => (
            <QueueCard key={card.key} card={card} value={counts[card.key]} />
          ))}
        </div>
      </section>

      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wider text-foreground-subtle">Catalogue totals</h2>
        <p className="mt-1 text-sm text-foreground-muted">Reference figures — no action implied.</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {CATALOGUE_CARDS.map((card) => {
            const Icon = card.icon;
            return (
              <Link
                key={card.key}
                href={card.href}
                className="card-interactive group flex items-center gap-4 rounded-lg border border-border bg-surface p-4 shadow-e1 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus-ring)]"
              >
                <span
                  aria-hidden="true"
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-tint text-brand"
                >
                  <Icon className="h-5 w-5" />
                </span>
                <span className="min-w-0">
                  <span className="block text-2xl font-semibold leading-none tracking-tight text-foreground">
                    {counts[card.key]}
                  </span>
                  <span className="mt-1 block text-sm font-medium text-foreground">{card.label}</span>
                  <span className="mt-0.5 block text-xs text-foreground-muted">{card.hint}</span>
                </span>
              </Link>
            );
          })}
        </div>
      </section>

      {recentAudit.length > 0 ? (
        <section>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-foreground-subtle">
              Recent audited activity
            </h2>
            <Link
              href="/staff/audit"
              className="inline-flex items-center gap-1 rounded text-sm font-medium text-brand hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus-ring)]"
            >
              Full audit log
              <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
            </Link>
          </div>
          <div className="mt-4 overflow-x-auto rounded-lg border border-border bg-surface shadow-e1">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-border bg-surface-muted text-xs uppercase tracking-wide text-foreground-muted">
                <tr>
                  <th scope="col" className="px-3 py-2.5 font-semibold">
                    When
                  </th>
                  <th scope="col" className="px-3 py-2.5 font-semibold">
                    Action
                  </th>
                  <th scope="col" className="px-3 py-2.5 font-semibold">
                    Entity
                  </th>
                  <th scope="col" className="px-3 py-2.5 font-semibold">
                    Summary
                  </th>
                </tr>
              </thead>
              <tbody>
                {recentAudit.map((entry) => (
                  <tr key={entry.id} className="border-t border-border transition-colors hover:bg-surface-muted/50">
                    <td className="px-3 py-2.5 whitespace-nowrap text-foreground-muted">
                      {entry.occurredAt.toLocaleString()}
                    </td>
                    <td className="px-3 py-2.5">
                      <code className="rounded bg-surface-muted px-1.5 py-0.5 text-xs text-foreground">
                        {entry.action}
                      </code>
                    </td>
                    <td className="px-3 py-2.5 text-foreground">{entry.entityName}</td>
                    <td className="px-3 py-2.5 text-foreground-muted">{entry.redactedChangeSummary}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}
    </div>
  );
}
