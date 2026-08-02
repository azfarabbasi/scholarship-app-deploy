import "server-only";
import { sql, type SQL } from "drizzle-orm";

interface SqlExecutor {
  execute(query: SQL): Promise<unknown>;
}

/**
 * Enables the database-side self-approval exception for the current
 * transaction only. `set_config(..., true)` is transaction-local, so the
 * capability cannot leak when the pooled connection is reused.
 */
export async function enableBootstrapAdminConstraintBypass(
  executor: SqlExecutor,
  bootstrapAdminStaffProfileId: string | null,
): Promise<void> {
  if (!bootstrapAdminStaffProfileId) return;

  await executor.execute(
    sql`select set_config('app.bootstrap_admin_actor_id', ${bootstrapAdminStaffProfileId}, true)`,
  );
}
