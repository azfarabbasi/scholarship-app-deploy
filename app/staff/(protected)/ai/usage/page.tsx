import { Badge } from "@/components/ui/Badge";
import { Card, CardBody } from "@/components/ui/Card";
import { getAiUsageSummary, listAiFeedback } from "@/lib/db/actions/ai-staff";

const RATING_TONE: Record<string, "green" | "red" | "amber" | "grey"> = {
  helpful: "green",
  "not-helpful": "red",
  incorrect: "red",
  "missing-citation": "amber",
  "outdated-source": "amber",
  "unsafe-misleading": "red",
  other: "grey",
};

export default async function StaffAiUsagePage() {
  const [summary, feedback] = await Promise.all([getAiUsageSummary(), listAiFeedback(50)]);

  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-foreground">AI usage &amp; feedback</h1>
        <p className="mt-1 text-sm text-foreground-muted">
          Guest usage is limited client-side via a signed cookie and isn&apos;t aggregately visible here — only
          signed-in usage is tracked server-side.
        </p>
      </div>

      {summary ? (
        <section className="rounded-lg border border-border p-4">
          <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
            <dt className="text-foreground-muted">Signed-in students with usage today</dt>
            <dd className="text-foreground">{summary.signedInStudentsWithUsageToday}</dd>
            <dt className="text-foreground-muted">Signed-in requests today</dt>
            <dd className="text-foreground">{summary.totalSignedInRequestsToday}</dd>
            <dt className="text-foreground-muted">Total conversations (with history enabled)</dt>
            <dd className="text-foreground">{summary.totalConversations}</dd>
            <dt className="text-foreground-muted">Total messages</dt>
            <dd className="text-foreground">{summary.totalMessages}</dd>
            <dt className="text-foreground-muted">Total feedback entries</dt>
            <dd className="text-foreground">{summary.totalFeedbackEntries}</dd>
          </dl>
        </section>
      ) : (
        <p className="text-sm text-foreground-muted">Not permitted to view usage data.</p>
      )}

      <div className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold text-foreground">Recent feedback</h2>
        {feedback.length === 0 ? (
          <p className="text-sm text-foreground-muted">No feedback submitted yet.</p>
        ) : (
          feedback.map((entry) => (
            <Card key={entry.id}>
              <CardBody className="flex flex-col gap-1">
                <div className="flex items-center justify-between gap-2">
                  <Badge tone={RATING_TONE[entry.rating] ?? "grey"}>{entry.rating}</Badge>
                  <span className="text-xs text-foreground-subtle">{new Date(entry.createdAt).toLocaleString()}</span>
                </div>
                {entry.comment ? <p className="text-sm text-foreground">{entry.comment}</p> : null}
              </CardBody>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
