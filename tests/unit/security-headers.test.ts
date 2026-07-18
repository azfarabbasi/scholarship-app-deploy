import { describe, expect, it } from "vitest";
import { buildContentSecurityPolicy } from "@/lib/security/csp";

const baseOptions = { nonce: "test-nonce", analyticsEnabled: false, adsEnabled: false, production: false };

describe("buildContentSecurityPolicy", () => {
  it("includes the per-request nonce in script-src", () => {
    const csp = buildContentSecurityPolicy(baseOptions);
    expect(csp).toContain("'nonce-test-nonce'");
    expect(csp).toContain("'strict-dynamic'");
  });

  it("sets the core clickjacking/injection defenses regardless of configuration", () => {
    const csp = buildContentSecurityPolicy(baseOptions);
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("base-uri 'self'");
    expect(csp).toContain("form-action 'self'");
  });

  it("never allows a bare wildcard script-src host", () => {
    const csp = buildContentSecurityPolicy(baseOptions);
    const scriptSrcDirective = csp.split(";").find((d) => d.trim().startsWith("script-src"));
    expect(scriptSrcDirective).toBeDefined();
    expect(scriptSrcDirective).not.toMatch(/script-src[^;]*\s\*(\s|$)/);
  });

  it("does not mention any third-party host when analytics and ads are both disabled", () => {
    const csp = buildContentSecurityPolicy(baseOptions);
    expect(csp).not.toContain("cloudflareinsights.com");
    expect(csp).not.toContain("googlesyndication.com");
  });

  it("widens script-src/connect-src for Cloudflare only when analytics is enabled", () => {
    const csp = buildContentSecurityPolicy({ ...baseOptions, analyticsEnabled: true });
    expect(csp).toContain("static.cloudflareinsights.com");
    expect(csp).toContain("cloudflareinsights.com");
    expect(csp).not.toContain("googlesyndication.com");
  });

  it("widens script-src/connect-src/img-src/frame-src for AdSense only when ads are enabled", () => {
    const csp = buildContentSecurityPolicy({ ...baseOptions, adsEnabled: true });
    expect(csp).toContain("googlesyndication.com");
    expect(csp).toContain("doubleclick.net");
    expect(csp).not.toContain("cloudflareinsights.com");
  });

  it("includes the Supabase origin in connect-src when a Supabase URL is configured", () => {
    const csp = buildContentSecurityPolicy({ ...baseOptions, supabaseUrl: "https://abcdefgh.supabase.co" });
    expect(csp).toContain("https://abcdefgh.supabase.co");
  });

  it("degrades gracefully (no throw) for a malformed Supabase URL", () => {
    expect(() => buildContentSecurityPolicy({ ...baseOptions, supabaseUrl: "not-a-url" })).not.toThrow();
  });

  it("only adds upgrade-insecure-requests in production", () => {
    const dev = buildContentSecurityPolicy(baseOptions);
    const prod = buildContentSecurityPolicy({ ...baseOptions, production: true });
    expect(dev).not.toContain("upgrade-insecure-requests");
    expect(prod).toContain("upgrade-insecure-requests");
  });
});
