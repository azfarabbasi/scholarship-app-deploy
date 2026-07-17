import { describe, expect, it } from "vitest";
import { MockAiProvider } from "@/lib/ai/providers/mock";

const provider = new MockAiProvider();

describe("MockAiProvider", () => {
  it("reports not-enough-information when no sources or structured facts are present", async () => {
    const result = await provider.generate({
      messages: [
        { role: "system", content: "You are the assistant." },
        { role: "user", content: "What is the deadline?" },
      ],
      maxOutputTokens: 200,
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.text).toBe("I do not have enough verified information to answer that.");
    }
  });

  it("states an exact verified deadline confidently when the structured fact says so", async () => {
    const result = await provider.generate({
      messages: [
        {
          role: "system",
          content: '<structured-fact kind="deadline" precision="exact" deadline-verification="verified" deadline-date="2026-11-01" />',
        },
        { role: "user", content: "What is the deadline for this opportunity?" },
      ],
      maxOutputTokens: 200,
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.text).toContain("2026-11-01");
      expect(result.text).toMatch(/verify/i);
    }
  });

  it("stays cautious about an unverified/estimated deadline", async () => {
    const result = await provider.generate({
      messages: [
        { role: "system", content: '<structured-fact kind="deadline" precision="estimated" deadline-verification="unverified" />' },
        { role: "user", content: "What is the deadline?" },
      ],
      maxOutputTokens: 200,
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.text).toMatch(/verify/i);
      expect(result.text).not.toMatch(/definitely/i);
    }
  });

  it("never claims final eligibility even when asked directly", async () => {
    const result = await provider.generate({
      messages: [
        { role: "system", content: '<structured-fact kind="matching" match-label="possible-fit" />' },
        { role: "user", content: "Am I eligible for this?" },
      ],
      maxOutputTokens: 200,
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.text).not.toMatch(/you are eligible/i);
      expect(result.text).toMatch(/not a final eligibility decision/i);
    }
  });

  it("reports document count when available", async () => {
    const result = await provider.generate({
      messages: [
        { role: "system", content: '<structured-fact kind="documents" document-count="3" />' },
        { role: "user", content: "What documents do I need?" },
      ],
      maxOutputTokens: 200,
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.text).toContain("3");
    }
  });

  it("still reports not-enough-information when a separate rules message merely mentions the tag names but no context message carries real material", async () => {
    // Regression test: `buildPromptMessages` always sends [rules, context, user].
    // The rules message explains the <source>/<structured-fact> tags by name,
    // which must never be mistaken for those tags actually being present.
    const result = await provider.generate({
      messages: [
        { role: "system", content: "Answer only using the <source> and <structured-fact> material provided below." },
        { role: "system", content: "<no-sources-available />" },
        { role: "user", content: "What is the deadline?" },
      ],
      maxOutputTokens: 200,
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.text).toBe("I do not have enough verified information to answer that.");
    }
  });

  it("cites source titles present in the context for a general question", async () => {
    const result = await provider.generate({
      messages: [
        { role: "system", content: '<source title="Official Helmholtz Page">Full tuition and stipend.</source>' },
        { role: "user", content: "Tell me about the funding." },
      ],
      maxOutputTokens: 200,
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.text).toContain("Official Helmholtz Page");
    }
  });
});
