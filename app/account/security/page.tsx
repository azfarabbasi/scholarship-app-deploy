import type { Metadata } from "next";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { ChangePasswordForm } from "@/components/account/ChangePasswordForm";
import { getStudentSession } from "@/lib/auth/student-session";

export const metadata: Metadata = {
  title: "Security",
  description: "Manage your ScholarTrack account sign-in.",
  alternates: { canonical: "/account/security" },
};

export default async function AccountSecurityPage() {
  const session = await getStudentSession();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-foreground">Security</h1>
        <p className="mt-2 max-w-2xl text-sm text-foreground-muted">
          Signed in as <span className="font-medium text-foreground">{session?.email}</span>. This account is
          completely separate from staff sign-in — it can never access <code>/staff</code>.
        </p>
      </div>

      <Card>
        <CardHeader>
          <h2 className="text-base font-semibold text-foreground">Change password</h2>
        </CardHeader>
        <CardBody>
          <ChangePasswordForm />
        </CardBody>
      </Card>
    </div>
  );
}
