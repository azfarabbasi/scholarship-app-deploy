import { Card, CardBody } from "@/components/ui/Card";
import type { EnrichedOpportunity } from "@/lib/catalogue/types";
import { checklistProgress } from "@/lib/storage/workspace";

export function WorkspaceSummary({ items, now }: { items: EnrichedOpportunity[]; now: Date }) {
  const shortlisted = items.filter((item) => item.workspace?.shortlisted).length;
  const inProgress = items.filter(
    (item) => item.workspace && !["not-started", "withdrawn", "unsuccessful", "awarded"].includes(item.workspace.stage),
  ).length;

  const todayIso = now.toISOString().slice(0, 10);
  let overdue = 0;
  let upcoming = 0;
  let checklistDone = 0;
  let checklistTotal = 0;

  for (const item of items) {
    const deadline = item.workspace?.personalDeadline;
    if (deadline) {
      if (deadline < todayIso) overdue += 1;
      else upcoming += 1;
    }
    if (item.workspace) {
      const progress = checklistProgress(item.workspace.checklist);
      checklistDone += progress.done;
      checklistTotal += progress.total;
    }
  }

  const tiles = [
    { label: "Shortlisted", value: shortlisted },
    { label: "Applications in progress", value: inProgress },
    { label: "Overdue personal deadlines", value: overdue },
    { label: "Upcoming personal deadlines", value: upcoming },
    { label: "Checklist tasks complete", value: checklistTotal > 0 ? `${checklistDone}/${checklistTotal}` : "0/0" },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-5" role="list" aria-label="Workspace summary">
      {tiles.map((tile) => (
        <Card key={tile.label} role="listitem">
          <CardBody className="py-4">
            <p className="text-xl font-semibold text-foreground">{tile.value}</p>
            <p className="mt-0.5 text-xs text-foreground-muted">{tile.label}</p>
          </CardBody>
        </Card>
      ))}
    </div>
  );
}
