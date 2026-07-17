import Link from "next/link";
import { getAiConfig } from "@/lib/ai/config";
import { getAiProviderHealth, getAiRetrievalCoverageReport } from "@/lib/db/actions/ai-staff";
import { AiKillSwitch } from "@/components/staff/AiKillSwitch";
import { getStaffSession } from "@/lib/auth/session";
import { canDisableAi } from "@/lib/auth/permissions";

export default async function StaffAiDashboardPage() {
  const session = await getStaffSession();
  const config = getAiConfig();
  const [health, coverage] = await Promise.all([getAiProviderHealth(), getAiRetrievalCoverageReport()]);

  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <h1 className="text-xl font-semibold text-foreground">AI assistant</h1>

      <section className="rounded-lg border border-border p-4">
        <h2 className="mb-2 text-sm font-semibold text-foreground">Configuration</h2>
        <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
          <dt className="text-foreground-muted">Enabled (env)</dt>
          <dd className="text-foreground">{config.enabled ? "Yes" : "No"}</dd>
          <dt className="text-foreground-muted">Provider</dt>
          <dd className="text-foreground">{config.provider}</dd>
          <dt className="text-foreground-muted">Available right now</dt>
          <dd className="text-foreground">{config.isAvailable ? "Yes" : "No — missing key, disabled, or mock-only"}</dd>
          <dt className="text-foreground-muted">Daily guest limit</dt>
          <dd className="text-foreground">{config.dailyGuestLimit}</dd>
          <dt className="text-foreground-muted">Daily signed-in limit</dt>
          <dd className="text-foreground">{config.dailyUserLimit}</dd>
        </dl>
      </section>

      {session && canDisableAi(session.roles) && health ? (
        <section>
          <h2 className="mb-2 text-sm font-semibold text-foreground">Runtime kill switch</h2>
          <AiKillSwitch manuallyDisabled={health.manuallyDisabled} disabledReason={health.disabledReason} />
        </section>
      ) : null}

      {coverage ? (
        <section className="rounded-lg border border-border p-4">
          <h2 className="mb-2 text-sm font-semibold text-foreground">Retrieval coverage</h2>
          <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
            <dt className="text-foreground-muted">Published opportunities</dt>
            <dd className="text-foreground">{coverage.totalPublishedOpportunities}</dd>
            <dt className="text-foreground-muted">With approved source coverage</dt>
            <dd className="text-foreground">{coverage.opportunitiesWithApprovedChunks}</dd>
            <dt className="text-foreground-muted">Draft / Approved / Rejected / Stale documents</dt>
            <dd className="text-foreground">
              {coverage.documentCountsByStatus.draft} / {coverage.documentCountsByStatus.approved} /{" "}
              {coverage.documentCountsByStatus.rejected} / {coverage.documentCountsByStatus.stale}
            </dd>
          </dl>
          <Link href="/staff/ai/sources" className="mt-3 inline-block text-sm text-brand hover:underline">
            Manage AI sources →
          </Link>
        </section>
      ) : null}

      <nav className="flex flex-wrap gap-3 text-sm">
        <Link href="/staff/ai/sources" className="text-brand hover:underline">
          Source management
        </Link>
        <Link href="/staff/ai/evaluations" className="text-brand hover:underline">
          Evaluation harness
        </Link>
        <Link href="/staff/ai/usage" className="text-brand hover:underline">
          Usage &amp; feedback
        </Link>
        <Link href="/staff/ai/safety" className="text-brand hover:underline">
          Safety log
        </Link>
      </nav>
    </div>
  );
}
