import { redirect } from "next/navigation";
import packageJson from "../../../../package.json";
import { canViewOpsDiagnostics } from "@/lib/auth/permissions";
import { getStaffSession } from "@/lib/auth/session";
import { getPublishedOpportunityCount } from "@/lib/catalogue/db-repository";
import { getAiConfig } from "@/lib/ai/config";
import { getAppEnv, isAdsConfigured, isAnalyticsConfigured, isDatabaseConfigured, isStaffAdminConfigured } from "@/lib/env";

export const metadata = { title: "Operational diagnostics", robots: { index: false, follow: false } };

async function checkDatabaseConnectivity(): Promise<"connected" | "unreachable" | "not-configured"> {
  if (!isDatabaseConfigured()) return "not-configured";
  try {
    await getPublishedOpportunityCount();
    return "connected";
  } catch {
    return "unreachable";
  }
}

function StatusRow({ label, value, ok }: { label: string; value: string; ok: boolean }) {
  return (
    <tr className="border-t border-border">
      <td className="px-3 py-2 text-foreground-muted">{label}</td>
      <td className="px-3 py-2 font-medium text-foreground">{value}</td>
      <td className="px-3 py-2">
        <span
          className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
            ok ? "bg-success-tint text-success" : "bg-danger-tint text-danger"
          }`}
        >
          {ok ? "OK" : "Attention"}
        </span>
      </td>
    </tr>
  );
}

export default async function StaffOpsPage() {
  const session = await getStaffSession();
  if (!session || !canViewOpsDiagnostics(session.roles)) {
    redirect("/staff");
  }

  const [databaseStatus, ai] = await Promise.all([checkDatabaseConnectivity(), Promise.resolve(getAiConfig())]);

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold text-foreground">Operational diagnostics</h1>
      <p className="text-sm text-foreground-muted">
        Safe, staff-only configuration and connectivity status. Never shows a secret value — only whether something
        is configured and reachable. Matches the public <code>/api/health</code>, <code>/api/ready</code>, and{" "}
        <code>/api/version</code> endpoints, with more detail than is safe to expose publicly.
      </p>
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-left text-sm">
          <thead className="bg-surface-muted text-foreground-muted">
            <tr>
              <th className="px-3 py-2">Component</th>
              <th className="px-3 py-2">Value</th>
              <th className="px-3 py-2">Status</th>
            </tr>
          </thead>
          <tbody>
            <StatusRow label="App version" value={`${packageJson.name}@${packageJson.version}`} ok />
            <StatusRow label="Environment (APP_ENV)" value={getAppEnv()} ok />
            <StatusRow
              label="Database"
              value={databaseStatus}
              ok={databaseStatus === "connected"}
            />
            <StatusRow label="Staff admin" value={isStaffAdminConfigured() ? "configured" : "not configured"} ok={isStaffAdminConfigured()} />
            <StatusRow
              label="AI assistant"
              value={ai.enabled ? `enabled (${ai.provider}${ai.isAvailable ? ", ready" : ", not ready"})` : "disabled"}
              ok={!ai.enabled || ai.isAvailable}
            />
            <StatusRow label="Analytics" value={isAnalyticsConfigured() ? "enabled" : "disabled"} ok />
            <StatusRow label="Ads" value={isAdsConfigured() ? "enabled" : "disabled"} ok />
          </tbody>
        </table>
      </div>
    </div>
  );
}
