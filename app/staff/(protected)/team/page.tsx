import { eq, isNull } from "drizzle-orm";
import { redirect } from "next/navigation";
import { getStaffSession } from "@/lib/auth/session";
import { canManageStaff } from "@/lib/auth/permissions";
import { getDb, schema } from "@/lib/db/client";
import { InviteStaffForm, RevokeRoleButton } from "@/components/staff/TeamForms";

export default async function StaffTeamPage() {
  const session = await getStaffSession();
  if (!session || !canManageStaff(session.roles)) {
    redirect("/staff");
  }

  const db = getDb();
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
            {rows.map((row) => (
              <tr key={row.assignmentId} className="border-t border-border">
                <td className="px-3 py-2">{row.displayName}</td>
                <td className="px-3 py-2">{row.email}</td>
                <td className="px-3 py-2">{row.role}</td>
                <td className="px-3 py-2 text-foreground-muted">{row.assignedAt.toLocaleDateString()}</td>
                <td className="px-3 py-2">
                  <RevokeRoleButton assignmentId={row.assignmentId} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <InviteStaffForm />
    </div>
  );
}
