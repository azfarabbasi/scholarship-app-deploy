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
 * Identifies the single staff account allowed to use the local/testing-only
 * bootstrap administrator bypass. All three conditions are required.
 */
export function hasBootstrapAdminAccess(
  identity: BootstrapAdminIdentity,
  configuration: BootstrapAdminConfiguration,
): boolean {
  if (!configuration.enabled || !configuration.configuredEmail || !identity.roles.includes("administrator")) {
    return false;
  }

  return identity.email.trim().toLowerCase() === configuration.configuredEmail.trim().toLowerCase();
}
