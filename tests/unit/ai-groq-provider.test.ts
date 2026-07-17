import { afterEach, describe, expect, it, vi } from "vitest";
import { GroqAiProvider } from "@/lib/ai/providers/groq";

const SECRET_KEY = "gsk_test_super_secret_key_do_not_leak_1234567890";

describe("GroqAiProvider", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("sends the API key only in the Authorization header, never in the request body", async () => {
    let capturedInit: RequestInit | undefined;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, init?: RequestInit) => {
        capturedInit = init;
        return new Response(JSON.stringify({ choices: [{ message: { content: "Hello." } }] }), { status: 200 });
      }),
    );

    const provider = new GroqAiProvider(SECRET_KEY, "test-model");
    const result = await provider.generate({ messages: [{ role: "user", content: "Hi" }], maxOutputTokens: 100 });

    expect(result.ok).toBe(true);
    expect(capturedInit?.body).not.toContain(SECRET_KEY);
    const headers = capturedInit?.headers as Record<string, string>;
    expect(headers.Authorization).toBe(`Bearer ${SECRET_KEY}`);
  });

  it("never leaks the API key or the raw provider response body in an error result", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ error: { message: "some internal diagnostic detail" } }), { status: 500 })),
    );

    const provider = new GroqAiProvider(SECRET_KEY, "test-model");
    const result = await provider.generate({ messages: [{ role: "user", content: "Hi" }], maxOutputTokens: 100 });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).not.toContain(SECRET_KEY);
      expect(result.error).not.toContain("internal diagnostic detail");
    }
  });

  it("returns a safe error when the provider returns an empty completion", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ choices: [] }), { status: 200 })));

    const provider = new GroqAiProvider(SECRET_KEY, "test-model");
    const result = await provider.generate({ messages: [{ role: "user", content: "Hi" }], maxOutputTokens: 100 });

    expect(result.ok).toBe(false);
  });

  it("returns a safe error when the network call throws", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("getaddrinfo ENOTFOUND api.groq.com — internal network detail");
      }),
    );

    const provider = new GroqAiProvider(SECRET_KEY, "test-model");
    const result = await provider.generate({ messages: [{ role: "user", content: "Hi" }], maxOutputTokens: 100 });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).not.toContain("ENOTFOUND");
      expect(result.error).not.toContain(SECRET_KEY);
    }
  });
});
