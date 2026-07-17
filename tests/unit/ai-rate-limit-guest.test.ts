import { describe, expect, it } from "vitest";
import { checkAndConsumeGuestQuota } from "@/lib/ai/rate-limit/guest";

describe("checkAndConsumeGuestQuota", () => {
  it("allows the first request of the day with no existing cookie", () => {
    const result = checkAndConsumeGuestQuota(undefined, 3);
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(2);
  });

  it("counts down across consecutive requests using the returned cookie value", () => {
    const first = checkAndConsumeGuestQuota(null, 2);
    expect(first.allowed).toBe(true);
    expect(first.remaining).toBe(1);

    const second = checkAndConsumeGuestQuota(first.nextCookieValue, 2);
    expect(second.allowed).toBe(true);
    expect(second.remaining).toBe(0);

    const third = checkAndConsumeGuestQuota(second.nextCookieValue, 2);
    expect(third.allowed).toBe(false);
    expect(third.remaining).toBe(0);
  });

  it("rejects a tampered cookie value by treating it as a fresh, empty count", () => {
    const legit = checkAndConsumeGuestQuota(undefined, 1);
    // Exhausts the daily limit of 1.
    const tampered = legit.nextCookieValue.replace(/.$/, legit.nextCookieValue.endsWith("A") ? "B" : "A");
    const result = checkAndConsumeGuestQuota(tampered, 1);
    // A tampered signature can't be trusted, so it resets to zero rather than granting extra or fewer requests than configured.
    expect(result.allowed).toBe(true);
  });

  it("treats garbage input as no existing quota rather than throwing", () => {
    const result = checkAndConsumeGuestQuota("not-a-valid-cookie-value", 5);
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(4);
  });

  it("denies requests once the configured daily limit of zero is reached immediately", () => {
    const result = checkAndConsumeGuestQuota(undefined, 0);
    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
  });
});
