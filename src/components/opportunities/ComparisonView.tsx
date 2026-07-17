"use client";

import Link from "next/link";
import { X } from "lucide-react";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { EmptyState } from "@/components/common/EmptyState";
import { AssistantChat } from "@/components/assistant/AssistantChat";
import { useCatalogue } from "@/hooks/useCatalogue";
import { useComparisonSelection } from "@/hooks/useComparisonSelection";
import { useMatchData } from "@/hooks/useMatchData";
import { evaluateMatch } from "@/lib/matching/engine";
import { MatchBadge } from "@/components/matching/MatchBadge";
import { checklistProgress } from "@/lib/storage/workspace";

interface ComparisonViewProps {
  studentProfileId: string | null;
  aiAvailable?: boolean;
}

export function ComparisonView({ studentProfileId, aiAvailable = false }: ComparisonViewProps) {
  const { items, loading } = useCatalogue();
  const comparison = useComparisonSelection();
  const { answers, planning } = useMatchData(studentProfileId);

  if (loading) return <p className="text-sm text-foreground-muted">Loading…</p>;

  const selected = comparison.ids.map((id) => items.find((item) => item.opportunity.id === id)).filter((v): v is NonNullable<typeof v> => Boolean(v));

  if (selected.length < 2) {
    return (
      <EmptyState
        title="Select at least 2 opportunities to compare"
        description="Go to the catalogue and check “Compare” on 2–4 opportunities."
        action={
          <Button size="sm" asChild>
            <Link href="/opportunities">Browse opportunities</Link>
          </Button>
        }
      />
    );
  }

  const rows: { label: string; render: (item: (typeof selected)[number]) => React.ReactNode }[] = [
    { label: "Country / region", render: (i) => [...i.opportunity.countries, ...i.opportunity.regions].join(", ") || "—" },
    { label: "Provider", render: (i) => i.opportunity.providerName ?? "—" },
    { label: "Study level", render: (i) => i.opportunity.studyLevels.join(", ") || "—" },
    { label: "Opportunity type", render: (i) => i.opportunity.opportunityType },
    { label: "Funding / benefit", render: (i) => i.opportunity.benefitSummary },
    { label: "Deadline state", render: (i) => i.evaluation.statusText },
    { label: "Verification status", render: (i) => i.opportunity.verification.status.replace(/_/g, " ") },
    { label: "Official source", render: (i) => (i.opportunity.verification.officialSourceLabel ? "Available" : "Not recorded") },
    { label: "Required documents", render: (i) => (i.opportunity.verification.documentCount > 0 ? `${i.opportunity.verification.documentCount} listed` : "Not recorded") },
    { label: "Structured eligibility", render: (i) => (i.opportunity.eligibilityRules.length > 0 ? `${i.opportunity.eligibilityRules.length} rule(s)` : "Not recorded") },
    {
      label: "Match label",
      render: (i) =>
        i.opportunity.kind === "built-in" ? <MatchBadge label={evaluateMatch(i.opportunity, answers, planning, i.evaluation).label} /> : "—",
    },
    { label: "Your stage", render: (i) => i.workspace?.stage ?? "not-started" },
    { label: "Personal deadline", render: (i) => (i.workspace?.personalDeadline ? new Date(i.workspace.personalDeadline).toLocaleDateString() : "Not set") },
    {
      label: "Checklist progress",
      render: (i) => {
        if (!i.workspace) return "—";
        const p = checklistProgress(i.workspace.checklist);
        return p.total > 0 ? `${p.done}/${p.total}` : "No tasks";
      },
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      <Alert tone="info">Comparing {selected.length} opportunities. This view is local to your browser only.</Alert>

      {/* Desktop: table. Mobile: stacked cards (same data, different layout) — both driven by the same `rows` definition. */}
      <div className="hidden overflow-x-auto rounded-lg border border-border md:block">
        <table className="w-full min-w-[640px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-border bg-surface-muted">
              <th className="p-3 text-left font-medium text-foreground-muted">Field</th>
              {selected.map((item) => (
                <th key={item.opportunity.id} className="p-3 text-left font-medium text-foreground">
                  <div className="flex items-center justify-between gap-2">
                    <Link href={`/opportunities/${item.opportunity.slug}`} className="hover:underline">
                      {item.opportunity.title}
                    </Link>
                    <button type="button" onClick={() => comparison.remove(item.opportunity.id)} aria-label={`Remove ${item.opportunity.title} from comparison`}>
                      <X className="h-4 w-4 text-foreground-subtle" aria-hidden="true" />
                    </button>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.label} className="border-b border-border last:border-0">
                <td className="p-3 font-medium text-foreground-muted">{row.label}</td>
                {selected.map((item) => (
                  <td key={item.opportunity.id} className="p-3 text-foreground">
                    {row.render(item)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex flex-col gap-4 md:hidden">
        {selected.map((item) => (
          <div key={item.opportunity.id} className="rounded-lg border border-border p-4">
            <div className="flex items-center justify-between gap-2">
              <Link href={`/opportunities/${item.opportunity.slug}`} className="font-semibold text-foreground hover:underline">
                {item.opportunity.title}
              </Link>
              <button type="button" onClick={() => comparison.remove(item.opportunity.id)} aria-label={`Remove ${item.opportunity.title} from comparison`}>
                <X className="h-4 w-4 text-foreground-subtle" aria-hidden="true" />
              </button>
            </div>
            <dl className="mt-2 flex flex-col gap-1.5 text-sm">
              {rows.map((row) => (
                <div key={row.label} className="flex justify-between gap-2">
                  <dt className="text-foreground-muted">{row.label}</dt>
                  <dd className="text-right text-foreground">{row.render(item)}</dd>
                </div>
              ))}
            </dl>
          </div>
        ))}
      </div>

      <Button variant="outline" size="sm" className="w-fit" onClick={comparison.clear}>
        Clear comparison
      </Button>

      {aiAvailable ? (
        <Card>
          <CardHeader>
            <h2 className="text-base font-semibold text-foreground">Ask about these opportunities</h2>
          </CardHeader>
          <CardBody>
            <AssistantChat
              studentProfileId={studentProfileId}
              scope="comparison"
              opportunitySlugs={selected.map((item) => item.opportunity.slug)}
              placeholder="Ask how these opportunities differ…"
              emptyStateText="Ask how these opportunities differ — deadlines, funding, eligibility, or documents — grounded in ScholarTrack's stored source data, with citations for each one."
            />
          </CardBody>
        </Card>
      ) : null}
    </div>
  );
}
