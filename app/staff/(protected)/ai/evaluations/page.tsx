import { Badge } from "@/components/ui/Badge";
import { Card, CardBody } from "@/components/ui/Card";
import { AiEvaluationRunner } from "@/components/staff/AiEvaluationRunner";
import { listAiEvaluationRuns } from "@/lib/db/actions/ai-staff";

const RESULT_TONE: Record<string, "green" | "red" | "amber"> = {
  pass: "green",
  fail: "red",
  error: "amber",
};

export default async function StaffAiEvaluationsPage() {
  const runs = await listAiEvaluationRuns(50);

  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-foreground">AI evaluations</h1>
        <p className="mt-1 text-sm text-foreground-muted">
          Runs the Checkpoint 5 fixture set against the mock provider — checking citations, refusals, and safety
          behaviour deterministically. Also available from the command line via <code>npm run ai:evaluate</code>.
        </p>
      </div>

      <AiEvaluationRunner />

      <div className="flex flex-col gap-2">
        {runs.length === 0 ? (
          <p className="text-sm text-foreground-muted">No evaluation runs yet — run the suite above.</p>
        ) : (
          runs.map((run) => (
            <Card key={run.id}>
              <CardBody className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm text-foreground">{run.provider} provider</p>
                  <p className="text-xs text-foreground-subtle">{new Date(run.createdAt).toLocaleString()}</p>
                </div>
                <Badge tone={RESULT_TONE[run.result] ?? "grey"}>{run.result}</Badge>
              </CardBody>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
