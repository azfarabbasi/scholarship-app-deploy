import { estimateTokenCount } from "@/lib/ai/token-estimate";

/**
 * Deterministic, dependency-free text splitter. Staff edit and approve
 * `ai_source_documents` at the whole-document level; this turns an approved
 * document's `sourceText` into the retrieval-sized `ai_source_chunks` rows
 * ("rebuild chunks" just re-runs this over the current text). No AI, no
 * network call, no randomness — the same input always produces the same
 * chunks, which is what makes chunk-related tests reproducible.
 */

export interface ChunkingOptions {
  /** Soft target size in characters — a chunk boundary is preferred at or after this length. */
  targetChars?: number;
  /** Hard ceiling in characters — a single sentence longer than this is still split, to bound provider input size. */
  maxChars?: number;
}

const DEFAULT_TARGET_CHARS = 700;
const DEFAULT_MAX_CHARS = 1100;

function splitIntoParagraphs(text: string): string[] {
  return text
    .split(/\n\s*\n+/)
    .map((paragraph) => paragraph.trim())
    .filter((paragraph) => paragraph.length > 0);
}

function splitIntoSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+(?=[A-Z0-9"'(])/)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length > 0);
}

function splitLongUnit(unit: string, maxChars: number): string[] {
  if (unit.length <= maxChars) {
    return [unit];
  }
  const pieces: string[] = [];
  let remaining = unit;
  while (remaining.length > maxChars) {
    pieces.push(remaining.slice(0, maxChars).trim());
    remaining = remaining.slice(maxChars);
  }
  if (remaining.trim().length > 0) {
    pieces.push(remaining.trim());
  }
  return pieces;
}

/**
 * Splits `text` into an ordered list of chunk strings. Prefers paragraph
 * boundaries, falls back to sentence boundaries within an over-long
 * paragraph, and as a last resort hard-splits a single over-long sentence —
 * never silently truncates content.
 */
export function chunkText(text: string, options: ChunkingOptions = {}): string[] {
  const targetChars = options.targetChars ?? DEFAULT_TARGET_CHARS;
  const maxChars = options.maxChars ?? DEFAULT_MAX_CHARS;

  const normalized = text.trim();
  if (normalized.length === 0) {
    return [];
  }

  const units: string[] = [];
  for (const paragraph of splitIntoParagraphs(normalized)) {
    if (paragraph.length <= maxChars) {
      units.push(paragraph);
      continue;
    }
    for (const sentence of splitIntoSentences(paragraph)) {
      units.push(...splitLongUnit(sentence, maxChars));
    }
  }

  const chunks: string[] = [];
  let current = "";
  for (const unit of units) {
    const candidate = current.length === 0 ? unit : `${current} ${unit}`;
    if (candidate.length > maxChars && current.length > 0) {
      chunks.push(current);
      current = unit;
      continue;
    }
    current = candidate;
    if (current.length >= targetChars) {
      chunks.push(current);
      current = "";
    }
  }
  if (current.length > 0) {
    chunks.push(current);
  }

  return chunks;
}

export interface ChunkDraft {
  chunkIndex: number;
  chunkText: string;
  tokenCountEstimate: number;
}

/** Convenience wrapper producing the exact shape `ai_source_chunks` rows are inserted from. */
export function buildChunkDrafts(text: string, options?: ChunkingOptions): ChunkDraft[] {
  return chunkText(text, options).map((chunk, index) => ({
    chunkIndex: index,
    chunkText: chunk,
    tokenCountEstimate: estimateTokenCount(chunk),
  }));
}
