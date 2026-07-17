/**
 * Retrieved source text (staff-authored excerpts, official-source extracts)
 * is treated as untrusted content, never as instructions — this module
 * strips or neutralizes any embedded attempt to redirect the assistant
 * before the text is ever concatenated into a prompt. This matters even
 * though staff approve excerpts before they're retrievable: an excerpt can
 * be a verbatim copy-paste of official-source text, and an attacker-controlled
 * web page is exactly the kind of place a prompt-injection payload could
 * already live before a staff member ever pastes it in.
 */

const INJECTION_PHRASE_PATTERNS = [
  /ignore\s+(all\s+)?(previous|prior|above)\s+instructions/gi,
  /disregard\s+(all\s+)?(previous|prior|above)\s+(instructions|rules)/gi,
  /system\s*:\s*/gi,
  /assistant\s*:\s*/gi,
  /you\s+are\s+now\s+/gi,
  /new\s+instructions?\s*:/gi,
  /reveal\s+(your|the)\s+(system\s+)?prompt/gi,
  /act\s+as\s+if\s+you\s+have\s+no\s+(restrictions|rules|guidelines)/gi,
];

const REDACTION_MARKER = "[neutralized: content resembling an embedded instruction was removed]";

/**
 * Replaces any recognisable injection phrase with a neutral marker so the
 * rest of the (legitimate) excerpt text is preserved for retrieval — this is
 * deliberately conservative pattern-stripping, not a full rewrite, so a
 * chunk that's 99% genuine official-source text isn't discarded wholesale
 * over one suspicious clause.
 */
export function neutralizeSourceText(text: string): string {
  let result = text;
  for (const pattern of INJECTION_PHRASE_PATTERNS) {
    result = result.replace(pattern, REDACTION_MARKER);
  }
  return result;
}

/** True if the raw text contains anything `neutralizeSourceText` would have stripped — used for safety-event logging. */
export function containsInjectionAttempt(text: string): boolean {
  return INJECTION_PHRASE_PATTERNS.some((pattern) => new RegExp(pattern.source, pattern.flags.replace("g", "")).test(text));
}
