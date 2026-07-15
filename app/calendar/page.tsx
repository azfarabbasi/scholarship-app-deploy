import type { Metadata } from "next";
import { Container } from "@/components/layout/Container";
import { CalendarView } from "@/components/calendar/CalendarView";

export const metadata: Metadata = {
  title: "Deadline calendar",
  description: "See upcoming and overdue deadlines in a month or agenda view, and export them to your own calendar.",
  alternates: { canonical: "/calendar" },
};

export default function CalendarPage() {
  return (
    <Container className="py-8 sm:py-10">
      <h1 className="text-2xl font-semibold text-foreground sm:text-3xl">Deadline calendar</h1>
      <p className="mt-2 max-w-2xl text-sm text-foreground-muted">
        Only exact, officially verified deadlines and your own personal reminders appear on dated views. Estimated,
        rolling, unknown, or unresolved deadlines are listed separately below.
      </p>
      <div className="mt-6">
        <CalendarView />
      </div>
    </Container>
  );
}
