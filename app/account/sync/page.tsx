import type { Metadata } from "next";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { MigrationPanel } from "@/components/account/MigrationPanel";
import { SyncStatusIndicator } from "@/components/account/SyncStatusIndicator";
import { getSyncState } from "@/lib/db/actions/student/sync";

export const metadata: Metadata = {
  title: "Sync & migration",
  description: "Bring your guest workspace data into your account and check cloud sync status.",
  alternates: { canonical: "/account/sync" },
};

export default async function AccountSyncPage() {
  const syncState = await getSyncState();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-foreground">Sync &amp; migration</h1>
        <p className="mt-2 max-w-2xl text-sm text-foreground-muted">
          Your workspace syncs automatically while you&rsquo;re signed in. Use this page to bring in data you tracked
          as a guest before signing in, and to check the current sync status.
        </p>
      </div>

      <Card>
        <CardHeader>
          <h2 className="text-base font-semibold text-foreground">Current status</h2>
        </CardHeader>
        <CardBody className="flex flex-col gap-2">
          <SyncStatusIndicator />
          <p className="text-sm text-foreground-muted">
            Device: {syncState?.deviceId ?? "this device"} · Schema version {syncState?.schemaVersion ?? 1}
          </p>
        </CardBody>
      </Card>

      <MigrationPanel />
    </div>
  );
}
