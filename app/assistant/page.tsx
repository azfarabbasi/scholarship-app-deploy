import { Sparkles } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Container } from "@/components/layout/Container";
import { AssistantWorkspace } from "@/components/assistant/AssistantWorkspace";
import { Alert } from "@/components/ui/Alert";
import { getStudentSession } from "@/lib/auth/student-session";
import { isAiAvailableAction } from "@/lib/db/actions/student/ai-assistant";

const EXAMPLE_PROMPTS = [
  "What master's scholarships are open right now?",
  "How do I know if a deadline is reliable?",
  "What documents do most scholarships ask for?",
];

export const metadata: Metadata = {
  title: "Scholarly",
  description: "Ask Scholarly, ScholarTrack's source-grounded assistant, about published scholarships and internships.",
  alternates: { canonical: "/assistant" },
};

export default async function AssistantPage() {
  const [session, available] = await Promise.all([getStudentSession(), isAiAvailableAction()]);

  return (
    <Container className="py-6 sm:py-8">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand text-brand-foreground shadow-brand">
            <Sparkles className="h-5 w-5" aria-hidden="true" />
          </span>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">Scholarly</h1>
            <p className="text-sm text-foreground-muted">Source-grounded answers, always cited.</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/assistant/history"
            className="rounded-lg border border-border bg-surface px-3 py-2 text-sm font-medium text-foreground-muted transition-colors hover:bg-surface-muted hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus-ring)]"
          >
            History
          </Link>
          <Link
            href="/assistant/settings"
            className="rounded-lg border border-border bg-surface px-3 py-2 text-sm font-medium text-foreground-muted transition-colors hover:bg-surface-muted hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus-ring)]"
          >
            Settings
          </Link>
        </div>
      </div>

      {available ? (
        <AssistantWorkspace
          studentProfileId={session?.studentProfileId ?? null}
          suggestedPrompts={EXAMPLE_PROMPTS}
        />
      ) : (
        <Alert tone="warning" title="Scholarly is not enabled yet">
          The assistant is currently unavailable. You can still browse and search the full catalogue without it — please
          check back later.
        </Alert>
      )}

      <p className="mt-4 text-xs text-foreground-subtle">
        Scholarly can get things wrong or miss updates — always verify on the official source before you rely on an
        answer.
      </p>
    </Container>
  );
}
