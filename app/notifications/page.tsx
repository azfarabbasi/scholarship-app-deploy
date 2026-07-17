import type { Metadata } from "next";
import Link from "next/link";
import { Container } from "@/components/layout/Container";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { NotificationCenter } from "@/components/notifications/NotificationCenter";
import { ReminderPreferencesForm } from "@/components/discovery/ReminderPreferencesForm";
import { getStudentSession } from "@/lib/auth/student-session";

export const metadata: Metadata = {
  title: "Notifications",
  description: "Upcoming and overdue reminders, saved-search alerts, and notification preferences.",
  alternates: { canonical: "/notifications" },
};

export default async function NotificationsPage() {
  const session = await getStudentSession();

  return (
    <Container className="max-w-3xl py-8 sm:py-10">
      <h1 className="text-2xl font-semibold text-foreground sm:text-3xl">Notifications</h1>
      <p className="mt-2 text-sm text-foreground-muted">
        Reminders for official and personal deadlines, plus alerts for your{" "}
        <Link href="/opportunities" className="underline">
          saved searches
        </Link>
        . {session ? "Synced to your account." : "Stored on this device."}
      </p>

      <div className="mt-6">
        <NotificationCenter studentProfileId={session?.studentProfileId ?? null} />
      </div>

      <Card className="mt-8">
        <CardHeader>
          <h2 className="text-base font-semibold text-foreground">Reminder preferences</h2>
        </CardHeader>
        <CardBody>
          <ReminderPreferencesForm studentProfileId={session?.studentProfileId ?? null} />
        </CardBody>
      </Card>
    </Container>
  );
}
