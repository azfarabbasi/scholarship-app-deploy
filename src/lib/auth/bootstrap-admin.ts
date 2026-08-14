import type { StaffRole } from "./permissions";

interface BootstrapAdminIdentity {
  email: string;
  roles: readonly StaffRole[];
}

interface BootstrapAdminConfiguration {
  configuredEmail?: string;
  enabled: boolean;
}

/**
 * Identifies staff accounts allowed to use the self-review bypass
 * (separation-of-duties exception): any active `administrator`, while
 * `ALLOW_ADMIN_SELF_REVIEW` is enabled. Originally restricted to the single
 * account matching `BOOTSTRAP_ADMIN_EMAIL`; broadened on request so every
 * administrator can review/verify/publish their own work solo, not just one
 * designated testing account. `configuredEmail` is intentionally unused now
 * but left in the signature/config shape to avoid a wider call-site churn.
 */
export function hasBootstrapAdminAccess(
  identity: BootstrapAdminIdentity,
  configuration: BootstrapAdminConfiguration,
): boolean {
  return configuration.enabled && identity.roles.includes("administrator");
}
