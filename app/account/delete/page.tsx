import type { Metadata } from "next";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { DeleteAccountSection } from "@/components/account/DeleteAccountSection";
import { getStudentSession } from "@/lib/auth/student-session";

export const metadata: Metadata = {
  title: "Delete data",
  description: "Delete your ScholarTrack cloud workspace data or your account entirely.",
  alternates: { canonical: "/account/delete" },
};

export default async function AccountDeletePage() {
  // Never null here: app/account/layout.tsx already redirects a signed-out
  // visitor before this page renders.
  const session = await getStudentSession();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-foreground">Delete data</h1>
        <p className="mt-2 max-w-2xl text-sm text-foreground-muted">
          Choose to clear just your cloud workspace, or delete your account entirely. Both are separate from your
          guest/local data, which you control from Settings.
        </p>
      </div>

      <Card>
        <CardHeader>
          <h2 className="text-base font-semibold text-foreground">Data controls</h2>
        </CardHeader>
        <CardBody>
          <DeleteAccountSection studentProfileId={session?.studentProfileId ?? null} />
        </CardBody>
      </Card>
    </div>
  );
}
