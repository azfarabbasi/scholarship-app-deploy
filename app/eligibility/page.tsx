import type { Metadata } from "next";
import { Container } from "@/components/layout/Container";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { EligibilityForm } from "@/components/discovery/EligibilityForm";
import { getStudentSession } from "@/lib/auth/student-session";

export const metadata: Metadata = {
  title: "Eligibility profile",
  description: "Optional questions used to compute deterministic, rule-based match labels — never AI, never a final decision.",
  alternates: { canonical: "/eligibility" },
};

export default async function EligibilityPage() {
  const session = await getStudentSession();

  return (
    <Container className="max-w-3xl py-8 sm:py-10">
      <h1 className="text-2xl font-semibold text-foreground sm:text-3xl">Eligibility profile</h1>
      <p className="mt-2 text-sm text-foreground-muted">
        Answer as much or as little as you like. This powers the match labels you&rsquo;ll see on opportunities — a
        planning aid, never a guarantee.
      </p>

      <Card className="mt-6">
        <CardHeader>
          <h2 className="text-base font-semibold text-foreground">Your answers</h2>
        </CardHeader>
        <CardBody>
          <EligibilityForm studentProfileId={session?.studentProfileId ?? null} />
        </CardBody>
      </Card>
    </Container>
  );
}
