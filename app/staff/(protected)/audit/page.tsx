import { redirect } from "next/navigation";
import { and, desc, eq } from "drizzle-orm";
import { getStaffSession } from "@/lib/auth/session";
import { canViewFullAuditLog } from "@/lib/auth/permissions";
import { getDb, schema } from "@/lib/db/client";

interface PageProps {
  searchParams: Promise<{ action?: string; entity?: string }>;
}

export default async function StaffAuditPage({ searchParams }: PageProps) {
  const session = await getStaffSession();
  if (!session || !canViewFullAuditLog(session.roles)) {
    redirect("/staff");
  }

  const { action, entity } = await searchParams;
  const db = getDb();

  const conditions = [];
  if (action) conditions.push(eq(schema.auditLog.action, action as never));
  if (entity) conditions.push(eq(schema.auditLog.entityName, entity));

  const rows = await db
    .select()
    .from(schema.auditLog)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(schema.auditLog.occurredAt))
    .limit(200);

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold text-foreground">Audit log</h1>
      <p className="text-sm text-foreground-muted">
        Append-only (enforced at the database level). Filter with <code>?action=publish</code> or{" "}
        <code>?entity=opportunities</code> in the URL.
      </p>
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-left text-sm">
          <thead className="bg-surface-muted text-foreground-muted">
            <tr>
              <th className="px-3 py-2">When</th>
              <th className="px-3 py-2">Actor role</th>
              <th className="px-3 py-2">Action</th>
              <th className="px-3 py-2">Entity</th>
              <th className="px-3 py-2">Reason</th>
              <th className="px-3 py-2">Summary</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-3 py-6 text-center text-foreground-muted">
                  No audit events match this filter.
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.id} className="border-t border-border">
                  <td className="px-3 py-2 whitespace-nowrap">{row.occurredAt.toLocaleString()}</td>
                  <td className="px-3 py-2">{row.actorRole ?? "system"}</td>
                  <td className="px-3 py-2">{row.action}</td>
                  <td className="px-3 py-2">{row.entityName}</td>
                  <td className="px-3 py-2 text-foreground-muted">{row.reasonCode ?? "—"}</td>
                  <td className="px-3 py-2 text-foreground-muted">{row.redactedChangeSummary}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
