import { desc } from "drizzle-orm";
import { redirect } from "next/navigation";
import { canRunImports } from "@/lib/auth/permissions";
import { getStaffSession } from "@/lib/auth/session";
import { getDb, schema } from "@/lib/db/client";
import { CsvImportForm } from "@/components/staff/CsvImportForm";

export default async function StaffImportsPage() {
  const session = await getStaffSession();
  if (!session || !canRunImports(session.roles)) {
    redirect("/staff");
  }

  const db = getDb();
  const jobs = await db.select().from(schema.importJobs).orderBy(desc(schema.importJobs.startedAt)).limit(50);

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <h1 className="text-xl font-semibold text-foreground">Imports</h1>

      <section>
        <h2 className="mb-2 text-sm font-semibold text-foreground">CSV import</h2>
        <p className="mb-2 text-sm text-foreground-muted">
          Import new opportunities as drafts (never auto-published). Always run a dry run first —{" "}
          <a href="/api/staff/csv-template" className="underline">
            download the template
          </a>
          .
        </p>
        <CsvImportForm />
      </section>

      <section>
        <h2 className="mb-2 text-sm font-semibold text-foreground">Legacy migration (v0.1 seed)</h2>
        <p className="text-sm text-foreground-muted">
          The original 55-record migration seed is imported via the command line, not this page — see{" "}
          <code>npm run db:import:legacy:dry-run</code> and <code>npm run db:import:legacy</code> in
          docs/checkpoint-2/migration-runbook.md. Its results still appear in the job history below.
        </p>
      </section>

      <section>
        <h2 className="mb-2 text-sm font-semibold text-foreground">Export</h2>
        <a href="/api/staff/export/opportunities" className="text-sm text-brand underline">
          Export published opportunities (CSV)
        </a>
      </section>

      <section>
        <h2 className="mb-2 text-sm font-semibold text-foreground">Job history</h2>
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-left text-sm">
            <thead className="bg-surface-muted text-foreground-muted">
              <tr>
                <th className="px-3 py-2">Started</th>
                <th className="px-3 py-2">Source</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Total</th>
                <th className="px-3 py-2">Accepted</th>
                <th className="px-3 py-2">Rejected</th>
                <th className="px-3 py-2">Duplicates</th>
              </tr>
            </thead>
            <tbody>
              {jobs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-3 py-6 text-center text-foreground-muted">
                    No import jobs yet.
                  </td>
                </tr>
              ) : (
                jobs.map((job) => (
                  <tr key={job.id} className="border-t border-border">
                    <td className="px-3 py-2 whitespace-nowrap">{job.startedAt.toLocaleString()}</td>
                    <td className="px-3 py-2">{job.sourceKind}</td>
                    <td className="px-3 py-2">{job.status}</td>
                    <td className="px-3 py-2">{job.totalRows}</td>
                    <td className="px-3 py-2">{job.acceptedRows}</td>
                    <td className="px-3 py-2">{job.rejectedRows}</td>
                    <td className="px-3 py-2">{job.duplicateWarnings}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
