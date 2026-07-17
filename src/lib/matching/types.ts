export const MATCH_LABELS = [
  "strong-potential-fit",
  "possible-fit",
  "needs-verification",
  "missing-information",
  "likely-not-a-fit",
  "deadline-risk",
  "not-enough-rule-data",
] as const;
export type MatchLabel = (typeof MATCH_LABELS)[number];

export const MATCH_LABEL_TEXT: Record<MatchLabel, string> = {
  "strong-potential-fit": "Strong potential fit",
  "possible-fit": "Possible fit",
  "needs-verification": "Needs verification",
  "missing-information": "Missing information",
  "likely-not-a-fit": "Likely not a fit",
  "deadline-risk": "Deadline risk",
  "not-enough-rule-data": "Not enough rule data",
};

export const MATCH_CONFIDENCE_LEVELS = ["low", "medium", "high"] as const;
export type MatchConfidence = (typeof MATCH_CONFIDENCE_LEVELS)[number];

export interface MatchReason {
  text: string;
  /** Formal eligibility rules and mere planning preferences must never be presented as the same kind of signal. */
  source: "eligibility-rule" | "preference" | "deadline" | "verification";
}

export interface MatchResult {
  label: MatchLabel;
  confidence: MatchConfidence;
  positiveReasons: MatchReason[];
  warningReasons: MatchReason[];
  mismatchReasons: MatchReason[];
  missingInfoReasons: MatchReason[];
  deadlineNotes: string[];
  verificationNotes: string[];
  nextAction: string;
  /** Always present, always the same text — a match label is a planning aid, never a final decision. */
  disclaimer: string;
}

export const MATCH_DISCLAIMER =
  "This is a planning aid based on stored rules and your own answers — never a guarantee of eligibility, admission, or funding. Always verify with the official source before applying.";
