/**
 * Phase 4 item 10 (launch-audit remediation): deterministic e2e test
 * accounts.
 *
 * `tests/e2e/staff-auth.spec.ts` and `tests/e2e/student-auth-and-sync.spec.ts`
 * both have an "authenticated flows" block that `test.skip()`s itself unless
 * `E2E_STAFF_EMAIL`/`E2E_STAFF_PASSWORD` (and the two student equivalents)
 * are set — previously there was no scripted, repeatable way to provision
 * those accounts against a real Supabase test project; someone had to
 * manually sign up / manually promote a staff role every time, which is
 * exactly the "not deterministic" gap this script closes. This does NOT
 * remove the underlying dependency on a real Supabase project (this app's
 * auth is real Supabase Auth end to end — there is no local emulation of it
 * in this codebase), so the baseline `E2E_STAFF_EMAIL`-unset CI run still
 * correctly skips these tests. What this script buys is a one-command,
 * idempotent, always-the-same-result way to stand up the three accounts
 * those tests need whenever someone DOES want to run the full authenticated
 * e2e suite against a real Supabase test project (their own, or a
 * dedicated, separately-secrets-scoped CI job — never the routine,
 * no-secrets-required push/PR pipeline).
 *
 * Creates accounts directly via the Supabase Admin API with a known password
 * and `email_confirm: true` (never the invite-by-email flow
 * `bootstrap-admin.ts` uses, which doesn't let you set a password at all) —
 * idempotent: re-running resets each account's password back to the
 * expected value and leaves everything else alone.
 *
 * SAFETY: creates accounts with well-known, hard-coded-by-convention
 * credentials. Refuses to run unless both `--confirm` is passed AND
 * `APP_ENV` is not "production" — this must never be reachable against a
 * real production Supabase project.
 *
 * Usage:
 *   npm run e2e:provision-test-accounts -- --confirm
 */
import "dotenv/config";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { createClient } from "@supabase/supabase-js";
import * as schema from "../src/lib/db/schema";

const args = process.argv.slice(2);
const confirmed = args.includes("--confirm");

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY;
const databaseUrl = process.env.DATABASE_URL;

if (process.env.APP_ENV === "production") {
  console.error("Refusing to run: APP_ENV=production. This script must never run against a real production deployment.");
  process.exit(1);
}
if (!supabaseUrl || !supabaseSecretKey) {
  console.error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY must be set to call the Supabase Admin API.");
  process.exit(1);
}
if (!databaseUrl) {
  console.error("DATABASE_URL must be set.");
  process.exit(1);
}
if (!confirmed) {
  console.log("Dry run only (no --confirm passed). Would provision the accounts listed below via the Supabase Admin API.");
}

interface AccountSpec {
  label: string;
  emailVar: string;
  passwordVar: string;
  defaultEmail: string;
  defaultPassword: string;
}

const ACCOUNTS: AccountSpec[] = [
  { label: "staff", emailVar: "E2E_STAFF_EMAIL", passwordVar: "E2E_STAFF_PASSWORD", defaultEmail: "e2e-staff@scholartrack.test", defaultPassword: "E2E-test-staff-P4ssword!" },
  { label: "student A", emailVar: "E2E_STUDENT_EMAIL", passwordVar: "E2E_STUDENT_PASSWORD", defaultEmail: "e2e-student-a@scholartrack.test", defaultPassword: "E2E-test-student-a-P4ssword!" },
  { label: "student B", emailVar: "E2E_STUDENT2_EMAIL", passwordVar: "E2E_STUDENT2_PASSWORD", defaultEmail: "e2e-student-b@scholartrack.test", defaultPassword: "E2E-test-student-b-P4ssword!" },
];

async function findUserByEmail(admin: ReturnType<typeof createClient>["auth"]["admin"], email: string) {
  for (let page = 1; page <= 20; page += 1) {
    const { data, error } = await admin.listUsers({ page, perPage: 200 });
    if (error) break;
    const match = data.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
    if (match) return match;
    if (data.users.length < 200) break;
  }
  return null;
}

async function main() {
  const supabase = createClient(supabaseUrl as string, supabaseSecretKey as string, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const client = postgres(databaseUrl as string, { max: 1 });
  const db = drizzle(client, { schema });

  for (const account of ACCOUNTS) {
    const email = process.env[account.emailVar]?.trim() || account.defaultEmail;
    const password = process.env[account.passwordVar]?.trim() || account.defaultPassword;

    console.log(`\n${account.label}: ${email}`);
    if (!confirmed) continue;

    const existing = await findUserByEmail(supabase.auth.admin, email);
    let userId: string;
    if (existing) {
      const { error } = await supabase.auth.admin.updateUserById(existing.id, { password, email_confirm: true });
      if (error) throw new Error(`Failed to reset password for ${email}: ${error.message}`);
      userId = existing.id;
      console.log(`  updated existing auth user, password reset to the expected value`);
    } else {
      const { data, error } = await supabase.auth.admin.createUser({ email, password, email_confirm: true });
      if (error || !data.user) throw new Error(`Failed to create ${email}: ${error?.message ?? "unknown error"}`);
      userId = data.user.id;
      console.log(`  created new auth user`);
    }

    if (account.label === "staff") {
      await db
        .insert(schema.staffProfiles)
        .values({ id: userId, email, displayName: "E2E Test Staff", status: "active" })
        .onConflictDoUpdate({ target: schema.staffProfiles.id, set: { email, status: "active" } });
      const [existingRole] = await db
        .select({ id: schema.staffRoleAssignments.id })
        .from(schema.staffRoleAssignments)
        .where(eq(schema.staffRoleAssignments.staffProfileId, userId));
      if (!existingRole) {
        await db.insert(schema.staffRoleAssignments).values({ staffProfileId: userId, role: "reviewer", assignedByStaffProfileId: null });
      }
      console.log(`  staff_profiles/staff_role_assignments (reviewer) confirmed`);
    }
    // Student accounts need no DB-side setup — student_profiles is lazily
    // provisioned by ensureStudentProfile() the first time they actually
    // sign in (see src/lib/auth/student-session.ts).
  }

  await client.end();

  console.log(
    confirmed
      ? "\nDone. Set these same email/password pairs as E2E_STAFF_EMAIL/E2E_STAFF_PASSWORD, E2E_STUDENT_EMAIL/E2E_STUDENT_PASSWORD, and E2E_STUDENT2_EMAIL/E2E_STUDENT2_PASSWORD when running the full e2e suite."
      : "\nRe-run with --confirm to actually provision these accounts.",
  );
}

main().catch((error: unknown) => {
  console.error("e2e:provision-test-accounts failed:", error);
  process.exit(1);
});
