import Link from "next/link";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";

export default function StaffUnauthorizedPage() {
  return (
    <div className="mx-auto flex min-h-[70vh] max-w-md flex-col justify-center gap-4 px-4 py-12">
      <Alert tone="danger" title="No staff access">
        Your account is signed in but has no active staff role assignment. If you believe this is a mistake,
        contact an administrator — staff roles are granted individually and never inferred from sign-in alone.
      </Alert>
      <Button variant="outline" asChild>
        <Link href="/">Return to the public site</Link>
      </Button>
    </div>
  );
}
