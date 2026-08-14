import { Plus } from "lucide-react";
import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { Button } from "@/components/ui/Button";
import { workflowStatusLabel } from "@/components/staff/WorkflowStatusBadge";
import { BulkPublishTable } from "@/components/staff/BulkPublishTable";
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

      <BulkPublishTable rows={rows} />
    </div>
  );
}
