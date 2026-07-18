import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Generic signed-cookie daily counter for anonymous, unauthenticated public
 * mutation endpoints — the same pattern as the Checkpoint 5 AI guest quota
 * (`src/lib/ai/rate-limit/guest.ts`), generalized here rather than
 * duplicated, so a second caller (Checkpoint 6's correction-report endpoint)
 * doesn't need its own copy. Deliberately NOT IP-based: this project doesn't
 * keep an IP/anonymous-device table anywhere (no unbounded storage growth,
 * no IP logging to reason about under GDPR), and a signed cookie is enough
 * to stop the common case (a bot resubmitting from the same browser) without
 * that cost. It is an abuse deterrent, not an authentication boundary — a
 * motivated attacker can always clear cookies or use a different browser,
 * exactly like the AI guest quota it mirrors.
 */

const FALLBACK_SECRET = "scholartrack-cookie-rate-limit-local-fallback-secret-not-for-production";

function getSigningSecret(): string {
  return process.env.SUPABASE_SECRET_KEY?.trim() || FALLBACK_SECRET;
}

interface QuotaPayload {
  date: string;
  count: number;
}

function sign(scope: string, body: string): string {
  return createHmac("sha256", getSigningSecret()).update(`${scope}:${body}`).digest("base64url");
}

function encode(scope: string, payload: QuotaPayload): string {
  const body = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  return `${body}.${sign(scope, body)}`;
}

function decode(scope: string, cookieValue: string | undefined | null): QuotaPayload | null {
  if (!cookieValue) return null;
  const separatorIndex = cookieValue.lastIndexOf(".");
  if (separatorIndex <= 0) return null;
  const body = cookieValue.slice(0, separatorIndex);
  const signature = cookieValue.slice(separatorIndex + 1);
  const expected = sign(scope, body);

  const signatureBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  if (signatureBuffer.length !== expectedBuffer.length || !timingSafeEqual(signatureBuffer, expectedBuffer)) {
    return null;
  }

  try {
    const parsed = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as Partial<QuotaPayload>;
    if (typeof parsed.date !== "string" || typeof parsed.count !== "number" || !Number.isFinite(parsed.count)) {
      return null;
    }
    return { date: parsed.date, count: parsed.count };
  } catch {
    return null;
  }
}

function todayUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

export interface CookieRateLimitResult {
  allowed: boolean;
  remaining: number;
  /** Set this as the cookie's new value regardless of `allowed` — it always reflects the current day's true count. */
  nextCookieValue: string;
}

/**
 * Pure function: given a `scope` (so different endpoints never share a
 * counter even if they reuse this module), the current cookie value (or
 * none/invalid/tampered, all treated as "start of day at zero"), and the
 * configured daily limit, returns whether this request may proceed and the
 * cookie value the caller should set for the next request.
 */
export function checkAndConsumeCookieQuota(scope: string, existingCookieValue: string | undefined | null, dailyLimit: number): CookieRateLimitResult {
  const today = todayUtc();
  const existing = decode(scope, existingCookieValue);
  const currentCount = existing && existing.date === today ? existing.count : 0;

  if (currentCount >= dailyLimit) {
    return { allowed: false, remaining: 0, nextCookieValue: encode(scope, { date: today, count: currentCount }) };
  }

  const nextCount = currentCount + 1;
  return {
    allowed: true,
    remaining: Math.max(0, dailyLimit - nextCount),
    nextCookieValue: encode(scope, { date: today, count: nextCount }),
  };
}
