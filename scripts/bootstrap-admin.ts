/**
 * Controlled first-administrator bootstrap (Checkpoint 2, section 9).
 *
 * - Reads the target email ONLY from `BOOTSTRAP_ADMIN_EMAIL` — never
 *   hard-coded.
 * - Idempotent: running it again for the same email is a safe no-op.
 * - Never creates an administrator silently: without `--confirm` it only
 *   prints what it would do. If a DIFFERENT active administrator already
 *   exists, it also refuses unless `--force` is passed, so accidentally
 *   re-running this in a populated environment can't quietly mint a second
 *   admin.
 * - Not reachable as a route — this is a server-only script, run manually or
 *   as part of a controlled deploy step.
 * - Records an audit event for the assignment.
 *
 * Usage:
 *   BOOTSTRAP_ADMIN_EMAIL=you@example.com npm run db:bootstrap:admin -- --confirm
 */
import { config } from "dotenv";
import { eq, and, isNull } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { createClient } from "@supabase/supabase-js";
import * as schema from "../src/lib/db/schema";

// Match Next.js's local-development precedence: .env.local overrides .env,
// while .env still fills any keys not present in the local file.
config({ path: ".env.local" });
config();

const args = process.argv.slice(2);
const confirmed = args.includes("--confirm");
const forced = args.includes("--force");

const email = process.env.BOOTSTRAP_ADMIN_EMAIL;
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY;
const databaseUrl = process.env.DATABASE_URL;

if (!email) {
  console.error("BOOTSTRAP_ADMIN_EMAIL must be set. See docs/checkpoint-2/supabase-setup.md.");
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

async function findAuthUser(admin: ReturnType<typeof createClient>["auth"]["admin"], targetEmail: string) {
  for (let page = 1; page <= 20; page += 1) {
    const { data, error } = await admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    const match = data.users.find((user) => user.email?.toLowerCase() === targetEmail.toLowerCase());
    if (match) return match;
    if (data.users.length < 200) break;
  }
  return null;
}

async function findOrInviteAuthUser(admin: ReturnType<typeof createClient>["auth"]["admin"], targetEmail: string) {
  const existing = await findAuthUser(admin, targetEmail);
  if (existing) return { user: existing, created: false };

  const invite = await admin.inviteUserByEmail(targetEmail);
  if (invite.data?.user) {
    return { user: invite.data.user, created: true };
  }

  // Already registered (or invite email delivery isn't configured) — look the user up instead.
  for (let page = 1; page <= 20; page += 1) {
    const { data, error } = await admin.listUsers({ page, perPage: 200 });
    if (error) break;
    const match = data.users.find((u) => u.email?.toLowerCase() === targetEmail.toLowerCase());
    if (match) {
      return { user: match, created: false };
    }
    if (data.users.length < 200) break;
  }

  throw new Error(
    `Could not find or invite a Supabase Auth user for ${targetEmail}. Original invite error: ${invite.error?.message ?? "unknown"}`,
  );
}

async function main() {
  // Already validated at module scope above; re-asserted here because TS
  // does not carry a top-level const's narrowing into a nested function body.
  if (!email || !supabaseUrl || !supabaseSecretKey || !databaseUrl) {
    throw new Error("Missing required environment variables.");
  }

  const supabase = createClient(supabaseUrl, supabaseSecretKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const client = postgres(databaseUrl, { max: 1 });
  const db = drizzle(client, { schema });

  const existingActiveAdmins = await db
    .select({
      staffProfileId: schema.staffRoleAssignments.staffProfileId,
      email: schema.staffProfiles.email,
    })
    .from(schema.staffRoleAssignments)
    .innerJoin(schema.staffProfiles, eq(schema.staffProfiles.id, schema.staffRoleAssignments.staffProfileId))
    .where(
      and(
        eq(schema.staffRoleAssignments.role, "administrator"),
        isNull(schema.staffRoleAssignments.revokedAt),
        eq(schema.staffProfiles.status, "active"),
      ),
    );

  // Listing users is read-only. The dry-run path deliberately stops before
  // `inviteUserByEmail`, so it cannot send mail or create an Auth account.
  const existingAuthUser = await findAuthUser(supabase.auth.admin, email);
  const targetAlreadyActiveAdmin = existingActiveAdmins.some(
    (admin) =>
      admin.staffProfileId === existingAuthUser?.id || admin.email.trim().toLowerCase() === email.trim().toLowerCase(),
  );

  console.log(`Target: ${email} (auth user ${existingAuthUser?.id ?? "not registered yet"})`);
  console.log(`Active administrators: ${existingActiveAdmins.length}`);

  if (existingActiveAdmins.length > 0 && !targetAlreadyActiveAdmin && !forced) {
    console.error(
      "Refusing to bootstrap a second administrator without --force. Use the staff Team page to grant additional " +
        "administrators once at least one exists.",
    );
    await client.end();
    process.exit(1);
  }

  if (!confirmed) {
    console.log(
      `Dry run only (no --confirm passed). Would ${existingAuthUser ? "reuse the existing Auth user" : "invite the Auth user"}, upsert staff_profiles, and confirm the administrator role.`,
    );
    await client.end();
    return;
  }

  const { user } = existingAuthUser
    ? { user: existingAuthUser }
    : await findOrInviteAuthUser(supabase.auth.admin, email);
  const alreadyThisPersonIsAdmin = existingActiveAdmins.some((admin) => admin.staffProfileId === user.id);

  await db.transaction(async (tx) => {
    await tx
      .insert(schema.staffProfiles)
      .values({ id: user.id, email, displayName: email.split("@")[0], status: "active" })
      .onConflictDoUpdate({
        target: schema.staffProfiles.id,
        set: { email, status: "active" },
      });

    if (!alreadyThisPersonIsAdmin) {
      await tx.insert(schema.staffRoleAssignments).values({
        staffProfileId: user.id,
        role: "administrator",
        assignedByStaffProfileId: null,
      });

      await tx.insert(schema.auditLog).values({
        actorStaffProfileId: null,
        actorRole: "administrator",
        action: "permission-change",
        entityName: "staff_role_assignments",
        entityId: user.id,
        reasonCode: "bootstrap-admin-script",
        redactedChangeSummary: `Granted administrator to ${email} via the bootstrap script.`,
      });
    }
  });

  console.log(`Administrator role confirmed for ${email}.`);
  await client.end();
}

main().catch((error: unknown) => {
  console.error("Bootstrap failed:", error);
  process.exit(1);
});
