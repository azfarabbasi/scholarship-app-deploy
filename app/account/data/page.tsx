import type { Metadata } from "next";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { CloudDataSection } from "@/components/account/CloudDataSection";

export const metadata: Metadata = {
  title: "Export & import",
  description: "Export your ScholarTrack account data or import a previous export.",
  alternates: { canonical: "/account/data" },
};

export default function AccountDataPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-foreground">Export &amp; import</h1>
        <p className="mt-2 max-w-2xl text-sm text-foreground-muted">
          This is your cloud account data — separate from the guest local backup in Settings.
        </p>
      </div>

      <Card>
        <CardHeader>
          <h2 className="text-base font-semibold text-foreground">Your account data</h2>
        </CardHeader>
        <CardBody>
          <CloudDataSection />
        </CardBody>
      </Card>
    </div>
  );
}
