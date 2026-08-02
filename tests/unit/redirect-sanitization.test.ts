import { describe, expect, it } from "vitest";
import { sanitizeRedirectPath } from "@/lib/security/redirect";

const ORIGIN = "https://scholartrack.example";

describe("sanitizeRedirectPath", () => {
  it("accepts a plain same-origin path", () => {
    expect(sanitizeRedirectPath("/account/data", ORIGIN, "/account")).toBe("/account/data");
  });

  it("preserves query string and hash", () => {
    expect(sanitizeRedirectPath("/account/data?tab=export#section", ORIGIN, "/account")).toBe(
      "/account/data?tab=export#section",
    );
  });

  it("falls back for a null/undefined/empty path", () => {
    expect(sanitizeRedirectPath(null, ORIGIN, "/account")).toBe("/account");
    expect(sanitizeRedirectPath(undefined, ORIGIN, "/account")).toBe("/account");
    expect(sanitizeRedirectPath("", ORIGIN, "/account")).toBe("/account");
  });

  it("falls back for a path with no leading slash", () => {
    expect(sanitizeRedirectPath("evil.com", ORIGIN, "/account")).toBe("/account");
  });

  it("falls back for a protocol-relative path (//host)", () => {
    expect(sanitizeRedirectPath("//evil.com", ORIGIN, "/account")).toBe("/account");
  });

  it("falls back for an absolute URL with an explicit scheme", () => {
    expect(sanitizeRedirectPath("https://evil.com", ORIGIN, "/account")).toBe("/account");
    expect(sanitizeRedirectPath("javascript://evil.com", ORIGIN, "/account")).toBe("/account");
  });

  it("falls back for a backslash-based protocol-relative bypass (WHATWG treats \\ as / when resolving)", () => {
    expect(sanitizeRedirectPath("/\\evil.com", ORIGIN, "/account")).toBe("/account");
    expect(sanitizeRedirectPath("\\\\evil.com", ORIGIN, "/account")).toBe("/account");
    expect(sanitizeRedirectPath("/\\/evil.com", ORIGIN, "/account")).toBe("/account");
  });

  it("falls back for a path containing control characters", () => {
    expect(sanitizeRedirectPath(`/${String.fromCharCode(0)}/evil.com`, ORIGIN, "/account")).toBe("/account");
    expect(sanitizeRedirectPath("/\t/evil.com", ORIGIN, "/account")).toBe("/account");
    expect(sanitizeRedirectPath(`/account${String.fromCharCode(0x7f)}`, ORIGIN, "/account")).toBe("/account");
  });

  it("enforces requiredPrefix (staff flow)", () => {
    expect(sanitizeRedirectPath("/staff/opportunities", ORIGIN, "/staff", { requiredPrefix: "/staff" })).toBe(
      "/staff/opportunities",
    );
    expect(sanitizeRedirectPath("/account", ORIGIN, "/staff", { requiredPrefix: "/staff" })).toBe("/staff");
    expect(sanitizeRedirectPath("/staffing", ORIGIN, "/staff", { requiredPrefix: "/staff" })).toBe("/staff");
  });

  it("enforces disallowedPrefix (student flow must never bounce into /staff)", () => {
    expect(sanitizeRedirectPath("/account/data", ORIGIN, "/account", { disallowedPrefix: "/staff" })).toBe(
      "/account/data",
    );
    expect(sanitizeRedirectPath("/staff/opportunities", ORIGIN, "/account", { disallowedPrefix: "/staff" })).toBe(
      "/account",
    );
    expect(sanitizeRedirectPath("/staffing", ORIGIN, "/account", { disallowedPrefix: "/staff" })).toBe("/staffing");
  });

  it("applies flow scoping after URL dot-segment normalization", () => {
    expect(sanitizeRedirectPath("/staff/../account", ORIGIN, "/staff", { requiredPrefix: "/staff" })).toBe("/staff");
    expect(sanitizeRedirectPath("/staff/%2e%2e/account", ORIGIN, "/staff", { requiredPrefix: "/staff" })).toBe(
      "/staff",
    );
    expect(sanitizeRedirectPath("/account/../staff", ORIGIN, "/account", { disallowedPrefix: "/staff" })).toBe(
      "/account",
    );
    expect(sanitizeRedirectPath("/account/%2e%2e/staff", ORIGIN, "/account", { disallowedPrefix: "/staff" })).toBe(
      "/account",
    );
  });
});
