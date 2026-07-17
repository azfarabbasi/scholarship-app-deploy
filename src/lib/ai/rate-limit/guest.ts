import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Guest AI rate limiting via a signed, httpOnly cookie holding
 * `{date, count}` — deliberately NOT a growing anonymous-device database
 * table (no IP tracking, no unbounded storage growth; see
 * `docs/checkpoint-5/checkpoint-5-architecture.md`). The signature only
 * needs to stop a guest from hand-editing the cookie to reset their own
 * count — it is an abuse deterrent, not an authentication boundary, so a
 * safe local fallback secret is used when `SUPABASE_SECRET_KEY` isn't
 * configured (e.g. pure local dev with the mock provider and no Supabase
 * project at all) rather than throwing and breaking the whole assistant.
 */

export const GUEST_AI_QUOTA_COOKIE_NAME = "st_ai_guest_quota";
const FALLBACK_SECRET = "scholartrack-ai-guest-quota-local-fallback-secret-not-for-production";

function getSigningSecret(): string {
  return process.env.SUPABASE_SECRET_KEY?.trim() || FALLBACK_SECRET;
}

interface GuestQuotaPayload {
  date: string;
  count: number;
}

function sign(body: string): string {
  return createHmac("sha256", getSigningSecret()).update(body).digest("base64url");
}

function encode(payload: GuestQuotaPayload): string {
  const body = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  return `${body}.${sign(body)}`;
}

function decode(cookieValue: string | undefined | null): GuestQuotaPayload | null {
  if (!cookieValue) return null;
  const separatorIndex = cookieValue.lastIndexOf(".");
  if (separatorIndex <= 0) return null;
  const body = cookieValue.slice(0, separatorIndex);
  const signature = cookieValue.slice(separatorIndex + 1);
  const expected = sign(body);

  const signatureBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  if (signatureBuffer.length !== expectedBuffer.length || !timingSafeEqual(signatureBuffer, expectedBuffer)) {
    return null;
  }

  try {
    const parsed = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as Partial<GuestQuotaPayload>;
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

export interface GuestRateLimitResult {
  allowed: boolean;
  remaining: number;
  /** Set this as the cookie's new value regardless of `allowed` — it always reflects the current day's true count. */
  nextCookieValue: string;
}

/**
 * Pure function: given the current cookie value (or none/invalid/tampered,
 * all treated as "start of day at zero") and the configured daily limit,
 * returns whether this request may proceed and the cookie value the caller
 * should set for the next request. Does not itself touch `next/headers` so
 * it stays trivially unit-testable.
 */
export function checkAndConsumeGuestQuota(existingCookieValue: string | undefined | null, dailyLimit: number): GuestRateLimitResult {
  const today = todayUtc();
  const existing = decode(existingCookieValue);
  const currentCount = existing && existing.date === today ? existing.count : 0;

  if (currentCount >= dailyLimit) {
    return { allowed: false, remaining: 0, nextCookieValue: encode({ date: today, count: currentCount }) };
  }

  const nextCount = currentCount + 1;
  return {
    allowed: true,
    remaining: Math.max(0, dailyLimit - nextCount),
    nextCookieValue: encode({ date: today, count: nextCount }),
  };
}
