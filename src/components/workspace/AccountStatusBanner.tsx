import Link from "next/link";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";

interface AccountStatusBannerProps {
  signedIn: boolean;
  email?: string;
}

export function AccountStatusBanner({ signedIn, email }: AccountStatusBannerProps) {
  if (signedIn) {
    return (
      <Alert tone="success" title={`Signed in as ${email}`}>
        This workspace syncs to your ScholarTrack account.{" "}
        <Link href="/account" className="underline">
          Manage your account
        </Link>
        .
      </Alert>
    );
  }

  return (
    <Alert tone="info" title="You're using ScholarTrack as a guest">
      Everything below is stored only on this device — not uploaded anywhere.{" "}
      <Link href="/auth/signup" className="underline">
        Create an account
      </Link>{" "}
      or{" "}
      <Link href="/auth/login" className="underline">
        sign in
      </Link>{" "}
      to sync it across devices — this is entirely optional.
      <div className="mt-2">
        <Button size="sm" variant="outline" asChild>
          <Link href="/auth/signup">Create an account</Link>
        </Button>
      </div>
    </Alert>
  );
}
