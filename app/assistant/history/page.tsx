import type { Metadata } from "next";
import { Container } from "@/components/layout/Container";
import { AssistantHistoryList } from "@/components/assistant/AssistantHistoryList";
import { getStudentSession } from "@/lib/auth/student-session";

export const metadata: Metadata = {
  title: "Assistant history",
  description: "Review or delete your saved assistant conversations.",
  alternates: { canonical: "/assistant/history" },
};

export default async function AssistantHistoryPage() {
  const session = await getStudentSession();

  return (
    <Container className="py-8 sm:py-10">
      <h1 className="text-2xl font-semibold text-foreground sm:text-3xl">Assistant history</h1>
      <p className="mt-2 max-w-2xl text-sm text-foreground-muted">
        {session
          ? "Conversations saved to your account, if you've enabled AI history."
          : "Conversations saved on this device. They are never uploaded unless you sign in and choose to sync them."}
      </p>

      <div className="mt-6 max-w-3xl">
        <AssistantHistoryList studentProfileId={session?.studentProfileId ?? null} />
      </div>
    </Container>
  );
}
