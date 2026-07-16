import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { Button } from "@/components/ui/Button";
import { getDb, schema } from "@/lib/db/client";
import { OPPORTUNITY_WORKFLOW_STATUSES, type OpportunityWorkflowStatus } from "@/lib/workflow/opportunity-workflow";

interface PageProps {
  searchParams: Promise<{ status?: string }>;
}

export default async function StaffOpportunitiesPage({ searchParams }: PageProps) {
  const { status } = await searchParams;
  const db = getDb();

  const isValidStatus = (value: string | undefined): value is OpportunityWorkflowStatus =>
    Boolean(value) && (OPPORTUNITY_WORKFLOW_STATUSES as readonly string[]).includes(value as string);

  const rows = await db
    .select({
      id: schema.opportunities.id,
      title: schema.opportunities.title,
      status: schema.opportunities.status,
      updatedAt: schema.opportunities.updatedAt,
      providerName: schema.providers.displayName,
    })
    .from(schema.opportunities)
    .innerJoin(schema.providers, eq(schema.opportunities.providerId, schema.providers.id))
    .where(isValidStatus(status) ? eq(schema.opportunities.status, status) : undefined)
    .orderBy(desc(schema.opportunities.updatedAt))
    .limit(200);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-foreground">Opportunities</h1>
        <Button asChild size="sm">
          <Link href="/staff/opportunities/new">New draft</Link>
        </Button>
      </div>

      <div className="flex flex-wrap gap-2 text-sm">
        <Link href="/staff/opportunities" className={!status ? "font-semibold text-brand" : "text-foreground-muted"}>
          All
        </Link>
        {OPPORTUNITY_WORKFLOW_STATUSES.map((s) => (
          <Link
            key={s}
            href={`/staff/opportunities?status=${s}`}
            className={status === s ? "font-semibold text-brand" : "text-foreground-muted"}
          >
            {s}
          </Link>
        ))}
      </div>

      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-left text-sm">
          <thead className="bg-surface-muted text-foreground-muted">
            <tr>
              <th className="px-3 py-2">Title</th>
              <th className="px-3 py-2">Provider</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Updated</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-3 py-6 text-center text-foreground-muted">
                  No opportunities match this filter.
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.id} className="border-t border-border hover:bg-surface-muted">
                  <td className="px-3 py-2">
                    <Link href={`/staff/opportunities/${row.id}`} className="font-medium text-foreground hover:underline">
                      {row.title}
                    </Link>
                  </td>
                  <td className="px-3 py-2 text-foreground-muted">{row.providerName}</td>
                  <td className="px-3 py-2">{row.status}</td>
                  <td className="px-3 py-2 text-foreground-muted whitespace-nowrap">{row.updatedAt.toLocaleString()}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
