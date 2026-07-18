import { Sparkles } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Container } from "@/components/layout/Container";
import { AssistantChat } from "@/components/assistant/AssistantChat";
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
    <Container className="py-8 sm:py-10">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand-tint text-brand">
          <Sparkles className="h-5 w-5" aria-hidden="true" />
        </span>
        <div>
          <h1 className="text-2xl font-semibold text-foreground sm:text-3xl">Scholarly</h1>
          <p className="mt-1 max-w-2xl text-sm text-foreground-muted">
            Your friendly, source-grounded scholarship assistant. Ask about published opportunities and Scholarly answers
            using ScholarTrack&apos;s stored source data, always with citations — it never makes a final eligibility,
            admission, or funding decision.{" "}
            <Link href="/assistant/settings" className="text-brand underline">
              History &amp; privacy settings
            </Link>
            .
          </p>
        </div>
      </div>

      <Alert tone="info" className="mt-4 max-w-2xl">
        Scholarly can get things wrong or miss updates. Always verify deadlines, eligibility, and funding on the official
        source before you rely on an answer.
      </Alert>

      <div className="mt-6 max-w-3xl">
        {available ? (
          <AssistantChat studentProfileId={session?.studentProfileId ?? null} scope="general" suggestedPrompts={EXAMPLE_PROMPTS} />
        ) : (
          <Alert tone="warning" title="Scholarly is not enabled yet">
            The assistant is currently unavailable. You can still browse and search the full catalogue without it — please
            check back later.
          </Alert>
        )}
      </div>
    </Container>
  );
}
