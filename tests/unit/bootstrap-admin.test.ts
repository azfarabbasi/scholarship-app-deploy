import { describe, expect, it } from "vitest";
import { hasBootstrapAdminAccess } from "@/lib/auth/bootstrap-admin";

describe("bootstrap administrator identity", () => {
  const configuredEmail = "owner@example.test";

  it("requires the enabled flag, administrator role, and a case-insensitive email match", () => {
    expect(
      hasBootstrapAdminAccess(
        { email: " Owner@Example.Test ", roles: ["administrator"] },
        { configuredEmail, enabled: true },
      ),
    ).toBe(true);
  });

  it("does not elevate a different administrator", () => {
    expect(
      hasBootstrapAdminAccess(
        { email: "other@example.test", roles: ["administrator"] },
        { configuredEmail, enabled: true },
      ),
    ).toBe(false);
  });

  it("does not elevate a matching email without an active administrator role", () => {
    expect(
      hasBootstrapAdminAccess(
        { email: configuredEmail, roles: ["reviewer", "senior_reviewer"] },
        { configuredEmail, enabled: true },
      ),
    ).toBe(false);
  });

  it("is disabled when the feature flag or configured email is absent", () => {
    expect(
      hasBootstrapAdminAccess(
        { email: configuredEmail, roles: ["administrator"] },
        { configuredEmail, enabled: false },
      ),
    ).toBe(false);
    expect(
      hasBootstrapAdminAccess(
        { email: configuredEmail, roles: ["administrator"] },
        { enabled: true },
      ),
    ).toBe(false);
  });
});
