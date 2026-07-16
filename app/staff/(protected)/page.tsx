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

const CARDS: { key: keyof Awaited<ReturnType<typeof getDashboardCounts>>; label: string; href: string }[] = [
  { key: "drafts", label: "Drafts", href: "/staff/opportunities?status=draft" },
  { key: "pendingReview", label: "Pending review", href: "/staff/opportunities?status=in_review" },
  { key: "changesRequested", label: "Changes requested", href: "/staff/opportunities?status=changes_requested" },
  { key: "awaitingApproval", label: "Awaiting approval", href: "/staff/opportunities?status=reviewed" },
  { key: "published", label: "Published", href: "/staff/opportunities?status=published" },
  { key: "staleVerification", label: "Stale verification", href: "/staff/opportunities" },
  { key: "corrections", label: "Open correction reports", href: "/staff/corrections" },
  { key: "duplicates", label: "Pending duplicate candidates", href: "/staff/duplicates" },
  { key: "myAssignments", label: "My open review assignments", href: "/staff/reviews" },
];

export default async function StaffDashboardPage() {
  const session = await getStaffSession();
  if (!session) return null;

  const counts = await getDashboardCounts(session.staffProfileId);
  const db = getDb();
  const recentAudit = canViewFullAuditLog(session.roles)
    ? await db.select().from(schema.auditLog).orderBy(desc(schema.auditLog.occurredAt)).limit(10)
    : [];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-foreground">Staff dashboard</h1>
        <p className="text-sm text-foreground-muted">Signed in as {session.displayName} ({session.roles.join(", ")})</p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {CARDS.map((card) => (
          <Link
            key={card.key}
            href={card.href}
            className="rounded-lg border border-border bg-surface p-4 hover:bg-surface-muted"
          >
            <p className="text-2xl font-semibold text-foreground">{counts[card.key]}</p>
            <p className="text-sm text-foreground-muted">{card.label}</p>
          </Link>
        ))}
      </div>

      {recentAudit.length > 0 ? (
        <div>
          <h2 className="mb-2 text-sm font-semibold text-foreground">Recent audited activity</h2>
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-left text-sm">
              <thead className="bg-surface-muted text-foreground-muted">
                <tr>
                  <th className="px-3 py-2">When</th>
                  <th className="px-3 py-2">Action</th>
                  <th className="px-3 py-2">Entity</th>
                  <th className="px-3 py-2">Summary</th>
                </tr>
              </thead>
              <tbody>
                {recentAudit.map((entry) => (
                  <tr key={entry.id} className="border-t border-border">
                    <td className="px-3 py-2 whitespace-nowrap">{entry.occurredAt.toLocaleString()}</td>
                    <td className="px-3 py-2">{entry.action}</td>
                    <td className="px-3 py-2">{entry.entityName}</td>
                    <td className="px-3 py-2 text-foreground-muted">{entry.redactedChangeSummary}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </div>
  );
}
