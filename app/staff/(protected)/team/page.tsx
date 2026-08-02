import { eq, isNull } from "drizzle-orm";
import { redirect } from "next/navigation";
import { getStaffSession } from "@/lib/auth/session";
import { hasBootstrapAdminAccess } from "@/lib/auth/bootstrap-admin";
import { canManageStaff } from "@/lib/auth/permissions";
import { getDb, schema } from "@/lib/db/client";
import { getServerEnv } from "@/lib/env";
import { InviteStaffForm, RevokeRoleButton } from "@/components/staff/TeamForms";
import { Badge } from "@/components/ui/Badge";

export default async function StaffTeamPage() {
  const session = await getStaffSession();
  if (!session || !canManageStaff(session.roles)) {
    redirect("/staff");
  }

  const db = getDb();
  const env = getServerEnv("bootstrap administrator role protection");
  const rows = await db
    .select({
      assignmentId: schema.staffRoleAssignments.id,
      role: schema.staffRoleAssignments.role,
      assignedAt: schema.staffRoleAssignments.assignedAt,
      displayName: schema.staffProfiles.displayName,
      email: schema.staffProfiles.email,
      status: schema.staffProfiles.status,
    })
    .from(schema.staffRoleAssignments)
    .innerJoin(schema.staffProfiles, eq(schema.staffProfiles.id, schema.staffRoleAssignments.staffProfileId))
    .where(isNull(schema.staffRoleAssignments.revokedAt));

  return (
    <div className="flex max-w-2xl flex-col gap-4">
      <h1 className="text-xl font-semibold text-foreground">Team</h1>
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-left text-sm">
          <thead className="bg-surface-muted text-foreground-muted">
            <tr>
              <th className="px-3 py-2">Name</th>
              <th className="px-3 py-2">Email</th>
              <th className="px-3 py-2">Role</th>
              <th className="px-3 py-2">Since</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const isProtectedBootstrapRole =
                hasBootstrapAdminAccess(
                  { email: row.email, roles: [row.role] },
                  { configuredEmail: env.BOOTSTRAP_ADMIN_EMAIL, enabled: env.ALLOW_ADMIN_SELF_REVIEW },
                );

              return (
                <tr key={row.assignmentId} className="border-t border-border">
                  <td className="px-3 py-2">{row.displayName}</td>
                  <td className="px-3 py-2">{row.email}</td>
                  <td className="px-3 py-2">
                    <span>{row.role}</span>
                    {isProtectedBootstrapRole ? (
                      <Badge tone="amber" className="ml-2">
                        Protected bootstrap role
                      </Badge>
                    ) : null}
                  </td>
                  <td className="px-3 py-2 text-foreground-muted">{row.assignedAt.toLocaleDateString()}</td>
                  <td className="px-3 py-2">
                    {isProtectedBootstrapRole ? (
                      <span className="text-xs text-foreground-muted">Cannot revoke</span>
                    ) : (
                      <RevokeRoleButton assignmentId={row.assignmentId} />
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <InviteStaffForm />
    </div>
  );
}
