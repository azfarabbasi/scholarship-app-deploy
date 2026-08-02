import type { Metadata } from "next";
import { Container } from "@/components/layout/Container";
import { Alert } from "@/components/ui/Alert";
import { WorkspaceAssistantView } from "@/components/assistant/WorkspaceAssistantView";
import { getStudentSession } from "@/lib/auth/student-session";
import { isAiAvailableAction } from "@/lib/db/actions/student/ai-assistant";

export const metadata: Metadata = {
  title: "Scholarly for your workspace",
  description: "Cautious, source-grounded planning guidance across your tracked opportunities.",
  alternates: { canonical: "/workspace/assistant" },
};

export default async function WorkspaceAssistantPage() {
  const [session, available] = await Promise.all([getStudentSession(), isAiAvailableAction()]);

  return (
    <Container className="py-8 sm:py-10">
      <h1 className="text-2xl font-semibold text-foreground sm:text-3xl">Scholarly for your workspace</h1>
      <p className="mt-2 max-w-2xl text-sm text-foreground-muted">
        Plan next steps across your tracked opportunities. Your private notes and checklist text are never sent to
        Scholarly. It does receive each tracked opportunity&apos;s own published deadline, funding, and eligibility
        data, plus your deterministic match result for it — a fit label, a confidence level, and how many eligibility
        signals matched — derived from your own eligibility answers and preferences, but never those raw answers
        themselves.
      </p>

      <div className="mt-6 max-w-3xl">
        {available ? (
          <WorkspaceAssistantView studentProfileId={session?.studentProfileId ?? null} />
        ) : (
          <Alert tone="warning" title="Scholarly is not enabled yet">
            The assistant is currently unavailable. You can still manage your workspace without it.
          </Alert>
        )}
      </div>
    </Container>
  );
}
