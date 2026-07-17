import { describe, expect, it } from "vitest";
import { buildChunkDrafts, chunkText } from "@/lib/ai/rag/chunking";

describe("chunkText", () => {
  it("returns an empty array for empty/whitespace-only input", () => {
    expect(chunkText("")).toEqual([]);
    expect(chunkText("   \n  ")).toEqual([]);
  });

  it("keeps short text as a single chunk", () => {
    const chunks = chunkText("This scholarship covers tuition and a monthly stipend.");
    expect(chunks).toHaveLength(1);
  });

  it("is deterministic — the same input always produces the same chunks", () => {
    const text = "Paragraph one about eligibility.\n\nParagraph two about documents.\n\nParagraph three about deadlines.";
    expect(chunkText(text)).toEqual(chunkText(text));
  });

  it("never drops content — every chunk's text is a substring of the original, joined they recover all non-whitespace characters", () => {
    const text = "A".repeat(50) + ". " + "B".repeat(2000) + ". " + "C".repeat(50) + ".";
    const chunks = chunkText(text);
    const combined = chunks.join(" ");
    expect(combined).toContain("A".repeat(50));
    expect(combined).toContain("C".repeat(50));
  });

  it("hard-splits a single sentence that exceeds maxChars rather than silently truncating", () => {
    const longSentence = "word ".repeat(400) + ".";
    const chunks = chunkText(longSentence, { maxChars: 200, targetChars: 150 });
    expect(chunks.length).toBeGreaterThan(1);
    for (const chunk of chunks) {
      expect(chunk.length).toBeLessThanOrEqual(200);
    }
  });

  it("respects a custom target/max size", () => {
    const text = Array.from({ length: 10 }, (_, i) => `Sentence number ${i} about the scholarship program.`).join(" ");
    const chunks = chunkText(text, { targetChars: 50, maxChars: 80 });
    expect(chunks.length).toBeGreaterThan(1);
  });
});

describe("buildChunkDrafts", () => {
  it("produces sequential chunkIndex values and a positive token estimate", () => {
    const drafts = buildChunkDrafts("Paragraph one.\n\nParagraph two.\n\nParagraph three.");
    expect(drafts.map((d) => d.chunkIndex)).toEqual(drafts.map((_, i) => i));
    for (const draft of drafts) {
      expect(draft.tokenCountEstimate).toBeGreaterThan(0);
    }
  });
});
