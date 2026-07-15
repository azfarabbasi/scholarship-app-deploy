"use client";

import { Skeleton } from "@/components/ui/Skeleton";
import { useDeadlineEvaluation } from "@/hooks/useDeadlineEvaluation";
import type { DeadlineEvaluationInput } from "@/lib/deadlines/types";
import { DeadlineBadge, DeadlineCountdownText } from "./badges";

export function DeadlineStatus({ deadlineInput }: { deadlineInput: DeadlineEvaluationInput }) {
  const evaluation = useDeadlineEvaluation(deadlineInput);

  if (!evaluation) {
    return <Skeleton className="h-16 w-full max-w-sm" />;
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <DeadlineBadge evaluation={evaluation} />
        <DeadlineCountdownText evaluation={evaluation} />
      </div>
      <p className="text-sm text-foreground-muted">{evaluation.statusText}</p>
      {evaluation.verificationRequired ? (
        <p className="text-xs text-foreground-subtle">
          This fact has not completed official re-verification. Confirm it on the official website.
        </p>
      ) : null}
    </div>
  );
}
