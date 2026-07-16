import "server-only";
import { eq } from "drizzle-orm";
import { getDb, schema } from "@/lib/db/client";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export interface StudentSession {
  studentProfileId: string;
  email: string;
  displayName: string | null;
  onboardingCompletedAt: string | null;
}

/**
 * Creates the student's `student_profiles` row the first time they touch any
 * student workspace feature — never on staff sign-in, never on public
 * browsing. This is what keeps "signed in" and "has a student profile"
 * distinct: a staff member who only ever uses `/staff` never gets one of
 * these rows, and a student who never signs in never gets one either.
 * Idempotent: safe to call on every request.
 */
async function ensureStudentProfile(authUserId: string, email: string) {
  const db = getDb();
  const [existing] = await db
    .select()
    .from(schema.studentProfiles)
    .where(eq(schema.studentProfiles.id, authUserId))
    .limit(1);

  if (existing) {
    return existing;
  }

  const [created] = await db
    .insert(schema.studentProfiles)
    .values({ id: authUserId, email })
    .onConflictDoNothing({ target: schema.studentProfiles.id })
    .returning();

  if (created) {
    return created;
  }

  // Lost a race with a concurrent request that created the row first.
  const [row] = await db
    .select()
    .from(schema.studentProfiles)
    .where(eq(schema.studentProfiles.id, authUserId))
    .limit(1);
  return row;
}

/**
 * Resolves the current caller's student session, lazily provisioning their
 * `student_profiles` row, or `null` if they are not signed in / their
 * Supabase session is invalid. Uses `getClaims()` (asymmetric-JWT-aware
 * local verification) rather than trusting an unverified cookie payload —
 * the same approach `getStaffSession()` uses, and deliberately independent
 * of it: a student session never implies a staff session or vice versa.
 */
export async function getStudentSession(): Promise<StudentSession | null> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.getClaims();

  if (error || !data?.claims?.sub) {
    return null;
  }

  const authUserId = data.claims.sub;
  const email = typeof data.claims.email === "string" ? data.claims.email : "";

  const profile = await ensureStudentProfile(authUserId, email);
  if (!profile) {
    return null;
  }

  return {
    studentProfileId: profile.id,
    email: profile.email,
    displayName: profile.displayName,
    onboardingCompletedAt: profile.onboardingCompletedAt ? profile.onboardingCompletedAt.toISOString() : null,
  };
}

/** Convenience helper for pages/layouts that just need a yes/no gate. */
export async function requireStudentSession(): Promise<StudentSession> {
  const session = await getStudentSession();
  if (!session) {
    throw new Error("STUDENT_SESSION_REQUIRED");
  }
  return session;
}
