import type { Metadata } from "next";
import Link from "next/link";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { getMyProfile } from "@/lib/db/actions/student/profile";
import { getMyTracking } from "@/lib/db/actions/student/tracking";
import { getMyNotes } from "@/lib/db/actions/student/notes";
import { getMyChecklistTasks } from "@/lib/db/actions/student/checklist";
import { getMyCustomOpportunities } from "@/lib/db/actions/student/custom-opportunities";
import { getSyncState } from "@/lib/db/actions/student/sync";
import { ProfileForm } from "@/components/account/ProfileForm";

export const metadata: Metadata = {
  title: "Account",
  description: "Your ScholarTrack account: profile, sync status, workspace statistics, and data controls.",
  alternates: { canonical: "/account" },
};

export default async function AccountDashboardPage() {
  const [profile, tracking, notes, checklistTasks, customOpportunities, syncState] = await Promise.all([
    getMyProfile(),
    getMyTracking(),
    getMyNotes(),
    getMyChecklistTasks(),
    getMyCustomOpportunities(),
    getSyncState(),
  ]);

  const shortlistedCount = tracking.filter((row) => row.shortlisted).length;
  const checklistDone = checklistTasks.filter((task) => task.completed).length;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground sm:text-3xl">Account</h1>
        <p className="mt-2 max-w-2xl text-sm text-foreground-muted">
          This account exists only to sync your workspace across devices. Staff administration is a completely
          separate system — signing in here never grants access to `/staff`.
        </p>
      </div>

      <Card>
        <CardHeader>
          <h2 className="text-base font-semibold text-foreground">Sync status</h2>
        </CardHeader>
        <CardBody className="flex flex-col gap-2 text-sm text-foreground-muted">
          <p>
            Last synced:{" "}
            <span className="font-medium text-foreground">
              {syncState?.lastSuccessfulSyncAt ? new Date(syncState.lastSuccessfulSyncAt).toLocaleString() : "Not yet synced"}
            </span>
          </p>
          <p>
            Guest data migration:{" "}
            <span className="font-medium text-foreground">
              {syncState?.localMigrationCompletedAt ? "Completed" : "Not done yet"}
            </span>
          </p>
          {!syncState?.localMigrationCompletedAt ? (
            <Button size="sm" className="mt-1 w-fit" asChild>
              <Link href="/account/sync">Bring in your guest data</Link>
            </Button>
          ) : null}
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <h2 className="text-base font-semibold text-foreground">Workspace statistics</h2>
        </CardHeader>
        <CardBody>
          <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div>
              <dt className="text-xs text-foreground-muted">Tracked opportunities</dt>
              <dd className="text-xl font-semibold text-foreground">{tracking.length}</dd>
            </div>
            <div>
              <dt className="text-xs text-foreground-muted">Shortlisted</dt>
              <dd className="text-xl font-semibold text-foreground">{shortlistedCount}</dd>
            </div>
            <div>
              <dt className="text-xs text-foreground-muted">Notes</dt>
              <dd className="text-xl font-semibold text-foreground">{notes.length}</dd>
            </div>
            <div>
              <dt className="text-xs text-foreground-muted">Checklist tasks</dt>
              <dd className="text-xl font-semibold text-foreground">
                {checklistDone}/{checklistTasks.length}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-foreground-muted">Custom opportunities</dt>
              <dd className="text-xl font-semibold text-foreground">{customOpportunities.length}</dd>
            </div>
          </dl>
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <h2 className="text-base font-semibold text-foreground">Profile</h2>
        </CardHeader>
        <CardBody>
          <ProfileForm profile={profile} />
        </CardBody>
      </Card>

      <Alert tone="info" title="Where this data lives">
        Everything above is stored in ScholarTrack&rsquo;s database, used only to provide your workspace across
        devices. It is never sold, never shared with opportunity providers, and staff cannot casually browse it —
        see <Link href="/privacy" className="underline">Privacy</Link> and{" "}
        <Link href="/account/data" className="underline">Export &amp; import</Link> for full control over it.
      </Alert>
    </div>
  );
}
