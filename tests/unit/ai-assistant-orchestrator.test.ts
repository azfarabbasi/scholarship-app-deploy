import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resetAiConfigCacheForTests } from "@/lib/ai/config";

/**
 * Exercises `askAssistant` itself (not just the evaluation harness's
 * parallel re-implementation of its steps) for the two DB-touching
 * guarantees Phase 3 adds: the runtime health check fails CLOSED (item 9),
 * and a signed-in/guest request with genuinely no evidence never reaches the
 * provider at all (item 1) — verified here by making the mock provider throw
 * if it's ever called, so a wiring mistake that skipped the fast path would
 * fail loudly instead of silently returning a plausible-looking answer.
 */
vi.mock("@/lib/db/client", () => ({
  getDb: vi.fn(),
  schema: {
    aiProviderHealth: {},
    aiSafetyEvents: {},
  },
}));

const AI_ENV_KEYS = ["AI_ENABLED", "AI_PROVIDER", "AI_DAILY_GUEST_LIMIT", "AI_DAILY_USER_LIMIT"] as const;
let originalEnv: Record<string, string | undefined>;

beforeEach(() => {
  originalEnv = Object.fromEntries(AI_ENV_KEYS.map((key) => [key, process.env[key]]));
  process.env.AI_ENABLED = "true";
  process.env.AI_PROVIDER = "mock";
  resetAiConfigCacheForTests();
});

afterEach(() => {
  for (const key of AI_ENV_KEYS) {
    if (originalEnv[key] === undefined) delete process.env[key];
    else process.env[key] = originalEnv[key];
  }
  resetAiConfigCacheForTests();
  vi.restoreAllMocks();
});

describe("askAssistant fail-closed availability (Phase 3 item 9)", () => {
  it("treats a health-check DB failure as unavailable, never as 'assume enabled'", async () => {
    vi.resetModules();
    const { getDb } = await import("@/lib/db/client");
    vi.mocked(getDb).mockImplementation(() => {
      throw new Error("connection refused");
    });

    const { askAssistant } = await import("@/lib/ai/assistant");
    const result = await askAssistant({
      question: "What is the deadline?",
      requester: { kind: "guest", guestCookieValue: null },
    });

    expect(result.kind).toBe("unavailable");
  });
});

describe("askAssistant not-enough-info fast path (Phase 3 item 1)", () => {
  it("never calls the provider when retrieval returns no sources and no structured facts", async () => {
    vi.resetModules();
    const { getDb } = await import("@/lib/db/client");
    vi.mocked(getDb).mockReturnValue({
      select: () => ({ from: () => ({ limit: async () => [] }) }),
    } as never);

    vi.doMock("@/lib/ai/providers", () => ({
      getAiProvider: () => {
        throw new Error("provider must never be called when there is no evidence");
      },
    }));
    vi.doMock("@/lib/ai/rag/retrieval", async () => {
      const actual = await vi.importActual<typeof import("@/lib/ai/rag/retrieval")>("@/lib/ai/rag/retrieval");
      return { ...actual, retrieveForQuestion: async () => ({ sources: [], structuredFacts: [] }) };
    });

    const { askAssistant } = await import("@/lib/ai/assistant");
    const result = await askAssistant({
      question: "Tell me about a scholarship nobody has ever heard of.",
      requester: { kind: "guest", guestCookieValue: null },
    });

    expect(result.kind).toBe("answered");
    expect(result.text).toBe("I do not have enough verified information to answer that.");
    expect(result.citations).toEqual([]);
  });
});
