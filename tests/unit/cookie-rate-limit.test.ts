import { describe, expect, it } from "vitest";
import { checkAndConsumeCookieQuota } from "@/lib/security/cookie-rate-limit";

describe("checkAndConsumeCookieQuota", () => {
  it("allows the first request of the day with no existing cookie", () => {
    const result = checkAndConsumeCookieQuota("correction-report", undefined, 3);
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(2);
  });

  it("counts down across consecutive requests using the returned cookie value", () => {
    const first = checkAndConsumeCookieQuota("correction-report", null, 2);
    expect(first.allowed).toBe(true);
    const second = checkAndConsumeCookieQuota("correction-report", first.nextCookieValue, 2);
    expect(second.allowed).toBe(true);
    expect(second.remaining).toBe(0);
    const third = checkAndConsumeCookieQuota("correction-report", second.nextCookieValue, 2);
    expect(third.allowed).toBe(false);
  });

  it("keeps separate scopes from interfering with each other's counters", () => {
    const correctionQuota = checkAndConsumeCookieQuota("correction-report", undefined, 1);
    // A cookie value signed under a different scope must not be accepted for this scope —
    // it should be treated as tampered/absent (reset to zero), not cross-applied.
    const otherScope = checkAndConsumeCookieQuota("some-other-endpoint", correctionQuota.nextCookieValue, 1);
    expect(otherScope.allowed).toBe(true);
  });

  it("rejects a tampered cookie value by treating it as a fresh, empty count", () => {
    const legit = checkAndConsumeCookieQuota("correction-report", undefined, 1);
    const tampered = legit.nextCookieValue.replace(/.$/, legit.nextCookieValue.endsWith("A") ? "B" : "A");
    const result = checkAndConsumeCookieQuota("correction-report", tampered, 1);
    expect(result.allowed).toBe(true);
  });

  it("treats garbage input as no existing quota rather than throwing", () => {
    const result = checkAndConsumeCookieQuota("correction-report", "not-a-valid-cookie-value", 5);
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(4);
  });

  it("denies requests once the configured daily limit of zero is reached immediately", () => {
    const result = checkAndConsumeCookieQuota("correction-report", undefined, 0);
    expect(result.allowed).toBe(false);
  });
});
