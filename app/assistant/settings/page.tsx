import type { Metadata } from "next";
import { Container } from "@/components/layout/Container";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { AiSettingsSection } from "@/components/assistant/AiSettingsSection";
import { getStudentSession } from "@/lib/auth/student-session";

export const metadata: Metadata = {
  title: "Assistant settings",
  description: "Manage AI assistant history and privacy settings.",
  alternates: { canonical: "/assistant/settings" },
};

export default async function AssistantSettingsPage() {
  const session = await getStudentSession();

  return (
    <Container className="py-8 sm:py-10">
      <h1 className="text-2xl font-semibold text-foreground sm:text-3xl">Assistant settings</h1>
      <p className="mt-2 max-w-2xl text-sm text-foreground-muted">Control how the assistant handles your conversation history.</p>

      <div className="mt-6 max-w-2xl">
        <Card>
          <CardHeader>
            <h2 className="text-base font-semibold text-foreground">History &amp; privacy</h2>
          </CardHeader>
          <CardBody>
            <AiSettingsSection studentProfileId={session?.studentProfileId ?? null} />
          </CardBody>
        </Card>
      </div>
    </Container>
  );
}
