"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { recordAuditEvent } from "@/lib/audit/log";
import { canManageStaff, type StaffRole } from "@/lib/auth/permissions";
import { getStaffSession } from "@/lib/auth/session";
import { getDb, schema } from "@/lib/db/client";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { ActionResult } from "./opportunities";

async function requireAdminSession() {
  const session = await getStaffSession();
  if (!session || !canManageStaff(session.roles)) return null;
  return session;
}

/**
 * Invites a new staff member by email (creates the Supabase Auth user via
 * the admin API if one doesn't exist yet, sending them a sign-in email) and
 * grants the given role. There is no public registration path — this is the
 * only way a new staff account comes into existence after the initial
 * bootstrap.
 */
export async function inviteStaffMember(email: string, displayName: string, role: StaffRole): Promise<ActionResult> {
  const session = await requireAdminSession();
  if (!session) return { ok: false, error: "Not permitted." };

  const admin = createSupabaseAdminClient();
  const invite = await admin.auth.admin.inviteUserByEmail(email);

  let userId = invite.data?.user?.id;
  if (!userId) {
    for (let page = 1; page <= 20 && !userId; page += 1) {
      const { data } = await admin.auth.admin.listUsers({ page, perPage: 200 });
      userId = data?.users.find((u) => u.email?.toLowerCase() === email.toLowerCase())?.id;
      if (!data || data.users.length < 200) break;
    }
  }
  if (!userId) {
    return { ok: false, error: `Could not invite or find a Supabase Auth user for ${email}.` };
  }

  const db = getDb();
  await db
    .insert(schema.staffProfiles)
    .values({ id: userId, email, displayName, status: "active" })
    .onConflictDoUpdate({ target: schema.staffProfiles.id, set: { displayName, status: "active" } });

  await db.insert(schema.staffRoleAssignments).values({
    staffProfileId: userId,
    role,
    assignedByStaffProfileId: session.staffProfileId,
  });

  await recordAuditEvent(db, {
    actorStaffProfileId: session.staffProfileId,
    actorRole: session.roles[0] ?? null,
    action: "permission-change",
    entityName: "staff_role_assignments",
    entityId: userId,
    redactedChangeSummary: `Invited ${email} and granted role "${role}".`,
  });

  revalidatePath("/staff/team");
  return { ok: true };
}

export async function revokeStaffRole(assignmentId: string, reason: string): Promise<ActionResult> {
  const session = await requireAdminSession();
  if (!session) return { ok: false, error: "Not permitted." };

  const db = getDb();
  await db
    .update(schema.staffRoleAssignments)
    .set({ revokedAt: new Date(), revokedByStaffProfileId: session.staffProfileId })
    .where(eq(schema.staffRoleAssignments.id, assignmentId));

  await recordAuditEvent(db, {
    actorStaffProfileId: session.staffProfileId,
    actorRole: session.roles[0] ?? null,
    action: "permission-change",
    entityName: "staff_role_assignments",
    entityId: assignmentId,
    reasonCode: reason,
    redactedChangeSummary: "Revoked a staff role assignment.",
  });

  revalidatePath("/staff/team");
  return { ok: true };
}
