import type { Metadata } from "next";
import { Container } from "@/components/layout/Container";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { ThemeToggle } from "@/components/layout/ThemeToggle";
import { PlanningPreferencesForm } from "@/components/settings/PlanningPreferencesForm";
import { BackupSection } from "@/components/settings/BackupSection";
import { StorageDiagnosticsSection } from "@/components/settings/StorageDiagnosticsSection";
import { PwaSection } from "@/components/settings/PwaSection";
import { FeedbackSection } from "@/components/settings/FeedbackSection";

export const metadata: Metadata = {
  title: "Settings",
  description: "Theme, planning preferences, backup and restore, storage diagnostics, and app installation.",
  alternates: { canonical: "/settings" },
};

export default function SettingsPage() {
  return (
    <Container className="py-8 sm:py-10">
      <h1 className="text-2xl font-semibold text-foreground sm:text-3xl">Settings</h1>
      <p className="mt-2 max-w-2xl text-sm text-foreground-muted">
        Everything here affects only this device and browser.
      </p>

      <div className="mt-6 flex flex-col gap-6">
        <Card>
          <CardHeader>
            <h2 className="text-base font-semibold text-foreground">Theme</h2>
          </CardHeader>
          <CardBody>
            <ThemeToggle />
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <h2 className="text-base font-semibold text-foreground">Planning preferences</h2>
          </CardHeader>
          <CardBody>
            <PlanningPreferencesForm />
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <h2 className="text-base font-semibold text-foreground">Backup, restore &amp; local data</h2>
          </CardHeader>
          <CardBody>
            <BackupSection />
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <h2 className="text-base font-semibold text-foreground">Storage diagnostics</h2>
          </CardHeader>
          <CardBody>
            <StorageDiagnosticsSection />
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <h2 className="text-base font-semibold text-foreground">Install as an app</h2>
          </CardHeader>
          <CardBody>
            <PwaSection />
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <h2 className="text-base font-semibold text-foreground">Feedback</h2>
          </CardHeader>
          <CardBody>
            <FeedbackSection />
          </CardBody>
        </Card>
      </div>
    </Container>
  );
}
