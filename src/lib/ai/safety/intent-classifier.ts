/**
 * Pre-flight, provider-independent user-message screening. Runs *before* any
 * retrieval or provider call — a blocked message never reaches an LLM at
 * all, which is what makes this safety layer's behaviour deterministic and
 * testable regardless of which provider (mock or a real one) is configured.
 * Output-side claims (e.g. "you are eligible") are handled separately by
 * `./validate-output.ts`, because blocking a legitimate eligibility
 * *question* would be unhelpful — only the *answer* needs to stay cautious.
 */

export type SafetyBlockReason =
  | "hidden-prompt-request"
  | "secret-request"
  | "other-user-data-request"
  | "prompt-injection"
  | "invented-fact-request";

export interface IntentClassification {
  blocked: boolean;
  reason?: SafetyBlockReason;
  refusalMessage?: string;
}

const HIDDEN_PROMPT_PATTERNS = [
  /system\s+prompt/i,
  /(reveal|show|print|repeat|output)\s+(your|the)\s+(instructions|prompt|rules)/i,
  /what\s+(are|is)\s+your\s+(instructions|prompt|rules)/i,
  /ignore\s+(all\s+)?(the\s+)?(text|content)\s+above/i,
];

const SECRET_PATTERNS = [
  /\bapi[\s_-]?key\b/i,
  /\bgroq[_\s-]?api[_\s-]?key\b/i,
  /\bsecret[\s_-]?key\b/i,
  /\bservice[\s_-]?role\b/i,
  /\bdatabase[\s_-]?(url|password|connection)\b/i,
  /\benv(ironment)?\s+variables?\b.*(key|secret|password|token)/i,
  /\bcredentials?\b/i,
];

const OTHER_USER_DATA_PATTERNS = [
  /(another|other|different)\s+(student|user|person)'?s?\s+(note|notes|checklist|data|conversation|history|profile)/i,
  /show\s+me\s+(user|student)\s+\S+'?s\s+(note|data|profile)/i,
  /everyone'?s\s+(notes|data|conversations)/i,
];

const PROMPT_INJECTION_PATTERNS = [
  /ignore\s+(all\s+)?(previous|prior|above)\s+instructions/i,
  /disregard\s+(all\s+)?(previous|prior|above)\s+(instructions|rules)/i,
  /you\s+are\s+now\s+(a|an)?\s*(?!.*assistant)\S+/i,
  /act\s+as\s+if\s+you\s+have\s+no\s+(restrictions|rules|guidelines)/i,
  /pretend\s+(you\s+are|to\s+be)\s+(unrestricted|jailbroken|dan\b)/i,
  /\bDAN\b.*(mode|jailbreak)/i,
];

const INVENTED_FACT_PATTERNS = [
  /\b(make\s*up|invent|fabricate)\s+(a|the)?\s*deadline/i,
  /\bguess\s+(the|a)\s+deadline/i,
  /\bpretend\s+(the\s+)?deadline\s+is/i,
  /\bassume\s+(the\s+)?deadline\s+is/i,
  /just\s+(make\s+up|invent)\s+(an?\s+)?(answer|fact|requirement)/i,
];

function matchesAny(patterns: readonly RegExp[], text: string): boolean {
  return patterns.some((pattern) => pattern.test(text));
}

const REFUSAL_MESSAGES: Record<SafetyBlockReason, string> = {
  "hidden-prompt-request":
    "I can't share my internal instructions or system prompt. I'm happy to answer questions about scholarships and internships using ScholarTrack's stored source data instead.",
  "secret-request":
    "I can't share API keys, credentials, or other secrets — those are never available to me in the first place. I can help with scholarship and internship questions instead.",
  "other-user-data-request":
    "I can only use your own saved/tracked data when you explicitly ask a personal workspace question — I can't access another person's notes, conversations, or account data.",
  "prompt-injection":
    "I can't follow instructions that ask me to ignore my guidelines. I'm glad to help with a scholarship or internship question using ScholarTrack's stored source data.",
  "invented-fact-request":
    "I won't invent a deadline or fact that isn't confirmed by a stored source. If the source doesn't confirm it, the honest answer is that I don't have enough verified information.",
};

/** Pure, deterministic, and provider-independent — every check is a regex match, nothing calls a network or an LLM. */
export function classifyUserIntent(message: string): IntentClassification {
  if (matchesAny(HIDDEN_PROMPT_PATTERNS, message)) {
    return { blocked: true, reason: "hidden-prompt-request", refusalMessage: REFUSAL_MESSAGES["hidden-prompt-request"] };
  }
  if (matchesAny(SECRET_PATTERNS, message)) {
    return { blocked: true, reason: "secret-request", refusalMessage: REFUSAL_MESSAGES["secret-request"] };
  }
  if (matchesAny(OTHER_USER_DATA_PATTERNS, message)) {
    return { blocked: true, reason: "other-user-data-request", refusalMessage: REFUSAL_MESSAGES["other-user-data-request"] };
  }
  if (matchesAny(PROMPT_INJECTION_PATTERNS, message)) {
    return { blocked: true, reason: "prompt-injection", refusalMessage: REFUSAL_MESSAGES["prompt-injection"] };
  }
  if (matchesAny(INVENTED_FACT_PATTERNS, message)) {
    return { blocked: true, reason: "invented-fact-request", refusalMessage: REFUSAL_MESSAGES["invented-fact-request"] };
  }
  return { blocked: false };
}
