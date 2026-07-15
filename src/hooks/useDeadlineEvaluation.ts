"use client";

import { useMemo } from "react";
import { evaluateDeadline } from "@/lib/deadlines/engine";
import type { DeadlineEvaluationInput, DeadlineEvaluationResult } from "@/lib/deadlines/types";
import { useNow } from "./useNow";

/** Computes the deadline display state client-side so it never bakes in a stale build-time date. */
export function useDeadlineEvaluation(input: DeadlineEvaluationInput): DeadlineEvaluationResult | null {
  const now = useNow();
  return useMemo(() => (now ? evaluateDeadline(input, now) : null), [input, now]);
}
