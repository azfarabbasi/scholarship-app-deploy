import { Plus } from "lucide-react";
import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { Button } from "@/components/ui/Button";
import { WorkflowStatusBadge, workflowStatusLabel } from "@/components/staff/WorkflowStatusBadge";
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

  const activeStatus = isValidStatus(status) ? status : undefined;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Opportunities</h1>
          <p className="mt-1 text-sm text-foreground-muted">
            {activeStatus
              ? `Showing ${rows.length} ${workflowStatusLabel(activeStatus).toLowerCase()} ${
                  rows.length === 1 ? "opportunity" : "opportunities"
                }`
              : `Showing the ${rows.length} most recently updated`}
            {rows.length === 200 ? " (capped at 200)" : ""}.
          </p>
        </div>
        <Button asChild>
          <Link href="/staff/opportunities/new">
            <Plus className="h-4 w-4" aria-hidden="true" />
            New draft
          </Link>
        </Button>
      </div>

      {/* Pill tabs rather than a row of bare text links: with eleven statuses
          the old inline list gave no hit target and no clear selected state. */}
      <nav aria-label="Filter by status" className="flex flex-wrap gap-1.5">
        <Link
          href="/staff/opportunities"
          aria-current={!activeStatus ? "page" : undefined}
          className={
            !activeStatus
              ? "rounded-full border border-brand/30 bg-brand-tint px-3 py-1.5 text-sm font-medium text-brand"
              : "rounded-full border border-border px-3 py-1.5 text-sm text-foreground-muted transition-colors hover:border-brand/30 hover:bg-surface-muted hover:text-foreground"
          }
        >
          All
        </Link>
        {OPPORTUNITY_WORKFLOW_STATUSES.map((s) => (
          <Link
            key={s}
            href={`/staff/opportunities?status=${s}`}
            aria-current={activeStatus === s ? "page" : undefined}
            className={
              activeStatus === s
                ? "rounded-full border border-brand/30 bg-brand-tint px-3 py-1.5 text-sm font-medium text-brand"
                : "rounded-full border border-border px-3 py-1.5 text-sm text-foreground-muted transition-colors hover:border-brand/30 hover:bg-surface-muted hover:text-foreground"
            }
          >
            {workflowStatusLabel(s)}
          </Link>
        ))}
      </nav>

      <div className="overflow-x-auto rounded-lg border border-border bg-surface shadow-e1">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-border bg-surface-muted text-xs uppercase tracking-wide text-foreground-muted">
            <tr>
              <th scope="col" className="px-3 py-2.5 font-semibold">
                Title
              </th>
              <th scope="col" className="px-3 py-2.5 font-semibold">
                Provider
              </th>
              <th scope="col" className="px-3 py-2.5 font-semibold">
                Status
              </th>
              <th scope="col" className="px-3 py-2.5 font-semibold">
                Updated
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-3 py-12 text-center">
                  <p className="font-medium text-foreground">No opportunities match this filter.</p>
                  <p className="mt-1 text-sm text-foreground-muted">
                    Try{" "}
                    <Link href="/staff/opportunities" className="text-brand hover:underline">
                      clearing the status filter
                    </Link>{" "}
                    or start a new draft.
                  </p>
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.id} className="border-t border-border transition-colors hover:bg-surface-muted/50">
                  <td className="px-3 py-2.5">
                    <Link
                      href={`/staff/opportunities/${row.id}`}
                      className="rounded font-medium text-foreground hover:text-brand hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus-ring)]"
                    >
                      {row.title}
                    </Link>
                  </td>
                  <td className="px-3 py-2.5 text-foreground-muted">{row.providerName}</td>
                  <td className="px-3 py-2.5">
                    <WorkflowStatusBadge status={row.status} />
                  </td>
                  <td className="px-3 py-2.5 whitespace-nowrap text-foreground-muted">
                    {row.updatedAt.toLocaleString()}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
