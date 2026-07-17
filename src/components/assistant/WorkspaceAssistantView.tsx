"use client";

import { AssistantChat } from "@/components/assistant/AssistantChat";
import { EmptyState } from "@/components/common/EmptyState";
import { useCatalogue } from "@/hooks/useCatalogue";
import { useMatchData } from "@/hooks/useMatchData";
import { evaluateMatch } from "@/lib/matching/engine";

interface WorkspaceAssistantViewProps {
  studentProfileId: string | null;
}

/**
 * Plans from the student's own tracked opportunities — their deadlines,
 * eligibility rules, and (when available) deterministic match results —
 * never their private notes or checklist text, which stay local/cloud only
 * and are never sent to the assistant (see
 * `docs/checkpoint-5/checkpoint-5-architecture.md`, "workspace assistant").
 */
export function WorkspaceAssistantView({ studentProfileId }: WorkspaceAssistantViewProps) {
  const { items, loading } = useCatalogue();
  const { answers, planning, loading: matchLoading } = useMatchData(studentProfileId);

  if (loading) {
    return <p className="text-sm text-foreground-muted">Loading…</p>;
  }

  const tracked = items.filter((item) => item.workspace !== null);

  if (tracked.length === 0) {
    return (
      <EmptyState
        title="Track an opportunity to use the workspace assistant"
        description="Shortlist or start tracking an opportunity from the catalogue, then come back here to plan next steps."
      />
    );
  }

  const opportunitySlugs = tracked.map((item) => item.opportunity.slug);
  const matchResults = !matchLoading
    ? tracked
        .filter((item) => item.opportunity.kind === "built-in")
        .map((item) => ({
          opportunitySlug: item.opportunity.slug,
          match: evaluateMatch(item.opportunity, answers, planning, item.evaluation),
        }))
    : undefined;

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-foreground-muted">
        Planning across {tracked.length} tracked opportunit{tracked.length === 1 ? "y" : "ies"}: {tracked.map((t) => t.opportunity.title).join(", ")}.
      </p>
      <AssistantChat
        studentProfileId={studentProfileId}
        scope="workspace"
        opportunitySlugs={opportunitySlugs}
        matchResults={matchResults}
        placeholder="Ask about your tracked opportunities…"
        emptyStateText="Ask for cautious planning guidance across your tracked opportunities — e.g. which deadline is soonest, or what's still missing. This never replaces the deterministic matching engine or your own judgment."
      />
    </div>
  );
}
