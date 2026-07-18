import type { Metadata } from "next";
import Link from "next/link";
import { Container } from "@/components/layout/Container";
import { AssistantChat } from "@/components/assistant/AssistantChat";
import { Alert } from "@/components/ui/Alert";
import { getStudentSession } from "@/lib/auth/student-session";
import { isAiAvailableAction } from "@/lib/db/actions/student/ai-assistant";

export const metadata: Metadata = {
  title: "Assistant",
  description: "Ask questions about published scholarships and internships, with citations from ScholarTrack's stored source data.",
  alternates: { canonical: "/assistant" },
};

export default async function AssistantPage() {
  const [session, available] = await Promise.all([getStudentSession(), isAiAvailableAction()]);

  return (
    <Container className="py-8 sm:py-10">
      <h1 className="text-2xl font-semibold text-foreground sm:text-3xl">Assistant</h1>
      <p className="mt-2 max-w-2xl text-sm text-foreground-muted">
        Ask about published opportunities. Answers are grounded in ScholarTrack&apos;s stored source data and always include
        citations — the assistant never makes a final eligibility, admission, or funding decision.{" "}
        <Link href="/assistant/settings" className="text-brand underline">
          History &amp; privacy settings
        </Link>
        .
      </p>

      <div className="mt-6 max-w-3xl">
        {available ? (
          <AssistantChat studentProfileId={session?.studentProfileId ?? null} scope="general" />
        ) : (
          <Alert tone="warning" title="The assistant is currently unavailable">
            You can still browse and search the full catalogue without it. Please check back later.
          </Alert>
        )}
      </div>
    </Container>
  );
}
