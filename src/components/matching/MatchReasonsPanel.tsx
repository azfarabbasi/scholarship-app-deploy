import Link from "next/link";
import { Alert } from "@/components/ui/Alert";
import type { MatchResult } from "@/lib/matching/types";
import { MatchBadge } from "./MatchBadge";

export function MatchReasonsPanel({ result }: { result: MatchResult }) {
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border p-4">
      <div className="flex flex-wrap items-center gap-2">
        <MatchBadge label={result.label} />
        <span className="text-xs text-foreground-subtle">Confidence: {result.confidence}</span>
      </div>

      {result.positiveReasons.length > 0 ? (
        <ReasonList title="Why this might fit" tone="success" reasons={result.positiveReasons} />
      ) : null}
      {result.mismatchReasons.length > 0 ? (
        <ReasonList title="Why this is likely not a fit" tone="danger" reasons={result.mismatchReasons} />
      ) : null}
      {result.warningReasons.length > 0 ? <ReasonList title="Worth noting" tone="warning" reasons={result.warningReasons} /> : null}
      {result.missingInfoReasons.length > 0 ? (
        <ReasonList title="Missing information" tone="info" reasons={result.missingInfoReasons} />
      ) : null}

      {result.deadlineNotes.length > 0 ? (
        <Alert tone="warning" title="Deadline notes">
          <ul className="list-inside list-disc">
            {result.deadlineNotes.map((note, i) => (
              <li key={i}>{note}</li>
            ))}
          </ul>
        </Alert>
      ) : null}
      {result.verificationNotes.length > 0 ? (
        <Alert tone="info" title="Verification notes">
          <ul className="list-inside list-disc">
            {result.verificationNotes.map((note, i) => (
              <li key={i}>{note}</li>
            ))}
          </ul>
        </Alert>
      ) : null}

      <p className="text-sm text-foreground-muted">
        <strong>Next step:</strong> {result.nextAction}
      </p>
      {(result.label === "missing-information" || result.label === "not-enough-rule-data") && (
        <Link href="/eligibility" className="text-sm underline">
          Improve your eligibility profile
        </Link>
      )}
      <p className="text-xs text-foreground-subtle">{result.disclaimer}</p>
    </div>
  );
}

const TONE_TEXT_CLASS: Record<"success" | "danger" | "warning" | "info", string> = {
  success: "text-success",
  danger: "text-danger",
  warning: "text-warning",
  info: "text-info",
};

function ReasonList({
  title,
  tone,
  reasons,
}: {
  title: string;
  tone: "success" | "danger" | "warning" | "info";
  reasons: { text: string; source: string }[];
}) {
  return (
    <div>
      <p className={`text-sm font-medium ${TONE_TEXT_CLASS[tone]}`}>{title}</p>
      <ul className="mt-1 list-inside list-disc text-sm text-foreground-muted">
        {reasons.map((reason, i) => (
          <li key={i}>
            {reason.text}{" "}
            <span className="text-xs text-foreground-subtle">
              ({reason.source === "eligibility-rule" ? "official rule" : reason.source})
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
