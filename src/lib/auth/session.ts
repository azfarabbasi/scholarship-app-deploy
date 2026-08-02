import "server-only";
import { and, eq, isNull } from "drizzle-orm";
import { getDb, schema } from "@/lib/db/client";
import { getServerEnv } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { hasBootstrapAdminAccess } from "./bootstrap-admin";
import type { StaffRole } from "./permissions";

export interface StaffSession {
  staffProfileId: string;
  email: string;
  displayName: string;
  /** Every active (non-revoked) role assignment; usually one, occasionally more. */
  roles: StaffRole[];
  /** Server-derived testing super-admin capability; never trusted from request input. */
  isBootstrapAdmin: boolean;
}

/**
 * Resolves the current caller's staff session, or `null` if they are not
 * signed in, their Supabase session is invalid, their staff_profiles row is
 * suspended, or they hold no active role assignment at all — "authenticated
 * but unassigned" is deliberately treated the same as "not staff".
 *
 * Uses `getClaims()` (asymmetric-JWT-aware local verification, falling back
 * to a signature check against Supabase's JWKS) rather than trusting an
 * unverified cookie payload — the current recommended approach for secure
 * server-side session verification with `@supabase/ssr`.
 */
export async function getStaffSession(): Promise<StaffSession | null> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.getClaims();

  if (error || !data?.claims?.sub) {
    return null;
  }

  const staffProfileId = data.claims.sub;
  const verifiedEmail = typeof data.claims.email === "string" ? data.claims.email : null;
  const db = getDb();

  const [profile] = await db
    .select()
    .from(schema.staffProfiles)
    .where(eq(schema.staffProfiles.id, staffProfileId))
    .limit(1);

  if (!profile || profile.status !== "active") {
    return null;
  }

  const assignments = await db
    .select({ role: schema.staffRoleAssignments.role })
    .from(schema.staffRoleAssignments)
    .where(and(eq(schema.staffRoleAssignments.staffProfileId, staffProfileId), isNull(schema.staffRoleAssignments.revokedAt)));

  if (assignments.length === 0) {
    return null;
  }

  const roles = assignments.map((assignment) => assignment.role);
  const env = getServerEnv("bootstrap administrator access");
  const verifiedEmailMatchesProfile =
    Boolean(verifiedEmail) && verifiedEmail!.trim().toLowerCase() === profile.email.trim().toLowerCase();

  return {
    staffProfileId,
    email: profile.email,
    displayName: profile.displayName,
    roles,
    isBootstrapAdmin:
      verifiedEmailMatchesProfile &&
      hasBootstrapAdminAccess(
        { email: verifiedEmail!, roles },
        { configuredEmail: env.BOOTSTRAP_ADMIN_EMAIL, enabled: env.ALLOW_ADMIN_SELF_REVIEW },
      ),
  };
}
