import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  getAppEnv,
  getContactEmails,
  isAdsConfigured,
  isAnalyticsConfigured,
  isProductionEnvironment,
  resetPublicEnvCacheForTests,
} from "@/lib/env";

const ENV_KEYS = [
  "APP_ENV",
  "SECURITY_CONTACT_EMAIL",
  "SUPPORT_EMAIL",
  "NEXT_PUBLIC_FEEDBACK_EMAIL",
  "NEXT_PUBLIC_ANALYTICS_ENABLED",
  "NEXT_PUBLIC_ANALYTICS_PROVIDER",
  "NEXT_PUBLIC_CLOUDFLARE_WEB_ANALYTICS_TOKEN",
  "NEXT_PUBLIC_ADS_ENABLED",
  "NEXT_PUBLIC_AD_PROVIDER",
  "NEXT_PUBLIC_ADSENSE_CLIENT_ID",
] as const;

let originalEnv: Record<string, string | undefined>;

beforeEach(() => {
  originalEnv = Object.fromEntries(ENV_KEYS.map((key) => [key, process.env[key]]));
  for (const key of ENV_KEYS) delete process.env[key];
  resetPublicEnvCacheForTests();
});

afterEach(() => {
  for (const key of ENV_KEYS) {
    if (originalEnv[key] === undefined) delete process.env[key];
    else process.env[key] = originalEnv[key];
  }
  resetPublicEnvCacheForTests();
});

describe("getAppEnv / isProductionEnvironment", () => {
  it("defaults to development when APP_ENV is unset", () => {
    expect(getAppEnv()).toBe("development");
    expect(isProductionEnvironment()).toBe(false);
  });

  it("never throws for an invalid APP_ENV value", () => {
    process.env.APP_ENV = "totally-not-a-real-environment";
    expect(getAppEnv()).toBe("development");
  });

  it("recognizes production only for the exact value 'production'", () => {
    process.env.APP_ENV = "production";
    expect(isProductionEnvironment()).toBe(true);
  });

  it("recognizes test and preview as distinct, non-production environments", () => {
    process.env.APP_ENV = "test";
    expect(getAppEnv()).toBe("test");
    expect(isProductionEnvironment()).toBe(false);

    process.env.APP_ENV = "preview";
    expect(getAppEnv()).toBe("preview");
    expect(isProductionEnvironment()).toBe(false);
  });
});

describe("isAnalyticsConfigured", () => {
  it("is disabled by default with no env vars set", () => {
    expect(isAnalyticsConfigured()).toBe(false);
  });

  it("stays disabled when enabled but no provider token is set", () => {
    process.env.NEXT_PUBLIC_ANALYTICS_ENABLED = "true";
    process.env.NEXT_PUBLIC_ANALYTICS_PROVIDER = "cloudflare";
    expect(isAnalyticsConfigured()).toBe(false);
  });

  it("is enabled only when explicitly enabled AND fully configured", () => {
    process.env.NEXT_PUBLIC_ANALYTICS_ENABLED = "true";
    process.env.NEXT_PUBLIC_ANALYTICS_PROVIDER = "cloudflare";
    process.env.NEXT_PUBLIC_CLOUDFLARE_WEB_ANALYTICS_TOKEN = "test-token";
    expect(isAnalyticsConfigured()).toBe(true);
  });
});

describe("isAdsConfigured", () => {
  it("is disabled by default with no env vars set", () => {
    expect(isAdsConfigured()).toBe(false);
  });

  it("stays disabled when enabled but no publisher id is set", () => {
    process.env.NEXT_PUBLIC_ADS_ENABLED = "true";
    process.env.NEXT_PUBLIC_AD_PROVIDER = "adsense";
    expect(isAdsConfigured()).toBe(false);
  });

  it("is enabled only when explicitly enabled AND fully configured", () => {
    process.env.NEXT_PUBLIC_ADS_ENABLED = "true";
    process.env.NEXT_PUBLIC_AD_PROVIDER = "adsense";
    process.env.NEXT_PUBLIC_ADSENSE_CLIENT_ID = "ca-pub-test";
    expect(isAdsConfigured()).toBe(true);
  });
});

describe("getContactEmails", () => {
  it("never throws and returns null for every unset address", () => {
    expect(getContactEmails()).toEqual({ security: null, support: null, feedback: null });
  });

  it("returns configured addresses without requiring database/Supabase configuration", () => {
    process.env.SECURITY_CONTACT_EMAIL = "security@example.com";
    process.env.SUPPORT_EMAIL = "support@example.com";
    expect(getContactEmails()).toEqual({ security: "security@example.com", support: "support@example.com", feedback: null });
  });
});
