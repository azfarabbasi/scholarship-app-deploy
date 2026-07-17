import { Badge } from "@/components/ui/Badge";
import { Card, CardBody } from "@/components/ui/Card";
import { listAiSafetyEvents } from "@/lib/db/actions/ai-staff";

const KIND_TONE: Record<string, "red" | "amber" | "grey"> = {
  "hidden-prompt-request": "red",
  "secret-request": "red",
  "other-user-data-request": "red",
  "prompt-injection": "red",
  "invented-fact-request": "amber",
  "output-claim-stripped": "amber",
  "rate-limit-exceeded": "grey",
  "provider-error": "grey",
};

export default async function StaffAiSafetyPage() {
  const events = await listAiSafetyEvents(100);

  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-foreground">AI safety log</h1>
        <p className="mt-1 text-sm text-foreground-muted">
          Every blocked prompt-injection attempt, secret/hidden-prompt request, other-user-data request, rate-limit
          hit, provider error, and output-claim removal — redacted summaries only, never the full raw prompt or
          answer.
        </p>
      </div>

      <div className="flex flex-col gap-2">
        {events.length === 0 ? (
          <p className="text-sm text-foreground-muted">No safety events recorded — or not permitted to view this log (Administrator only).</p>
        ) : (
          events.map((event) => (
            <Card key={event.id}>
              <CardBody className="flex flex-col gap-1">
                <div className="flex items-center justify-between gap-2">
                  <Badge tone={KIND_TONE[event.kind] ?? "grey"}>{event.kind}</Badge>
                  <span className="text-xs text-foreground-subtle">{new Date(event.createdAt).toLocaleString()}</span>
                </div>
                <p className="text-sm text-foreground-muted">{event.redactedSummary}</p>
              </CardBody>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
