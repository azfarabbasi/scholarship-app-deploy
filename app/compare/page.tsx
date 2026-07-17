import type { Metadata } from "next";
import { Container } from "@/components/layout/Container";
import { ComparisonView } from "@/components/opportunities/ComparisonView";
import { getStudentSession } from "@/lib/auth/student-session";

export const metadata: Metadata = {
  title: "Compare opportunities",
  description: "Compare 2-4 opportunities side by side.",
  alternates: { canonical: "/compare" },
};

export default async function ComparePage() {
  const session = await getStudentSession();

  return (
    <Container className="py-8 sm:py-10">
      <h1 className="text-2xl font-semibold text-foreground sm:text-3xl">Compare opportunities</h1>
      <p className="mt-2 max-w-2xl text-sm text-foreground-muted">
        Select up to 4 opportunities from the catalogue to compare deadlines, funding, and match labels side by side.
      </p>
      <div className="mt-6">
        <ComparisonView studentProfileId={session?.studentProfileId ?? null} />
      </div>
    </Container>
  );
}
