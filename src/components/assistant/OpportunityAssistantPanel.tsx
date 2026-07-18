"use client";

import { Sparkles } from "lucide-react";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { AssistantChat } from "@/components/assistant/AssistantChat";
import type { MatchResult } from "@/lib/matching/types";

interface OpportunityAssistantPanelProps {
  studentProfileId: string | null;
  opportunitySlug: string;
  opportunityTitle: string;
  /** The deterministic match result already computed for this opportunity (if any) — the assistant may explain it, never recompute it. */
  match: MatchResult | null;
}

export function OpportunityAssistantPanel({ studentProfileId, opportunitySlug, opportunityTitle, match }: OpportunityAssistantPanelProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <h2 className="text-base font-semibold text-foreground">Ask about this opportunity</h2>
        <span className="inline-flex items-center gap-1 text-xs font-medium text-brand">
          <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
          Scholarly
        </span>
      </CardHeader>
      <CardBody>
        <AssistantChat
          studentProfileId={studentProfileId}
          scope="opportunity"
          opportunitySlugs={[opportunitySlug]}
          matchResults={match ? [{ opportunitySlug, match }] : undefined}
          placeholder={`Ask about ${opportunityTitle}…`}
          emptyStateText="Ask about this opportunity's deadline, funding, eligibility, or required documents — grounded in ScholarTrack's stored source data, with citations."
          suggestedPrompts={["Explain this scholarship", "What should I verify?", "Compare this with my shortlist"]}
        />
      </CardBody>
    </Card>
  );
}
