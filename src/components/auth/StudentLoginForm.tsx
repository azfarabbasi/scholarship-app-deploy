"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";
import { Input, Label } from "@/components/ui/Field";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

/** Only ever redirect to a same-origin, non-`/staff` path — never an open redirect. */
function sanitizeNextPath(path: string | null): string {
  if (!path || path.startsWith("/staff") || path.startsWith("//") || path.includes("://")) {
    return "/account";
  }
  return path;
}

export function StudentLoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const supabase = createSupabaseBrowserClient();
      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });

      if (signInError) {
        if (/email not confirmed/i.test(signInError.message)) {
          setError("Please confirm your email address first — check your inbox for a confirmation link.");
        } else {
          setError("Sign-in failed. Check your email and password and try again.");
        }
        setSubmitting(false);
        return;
      }

      router.replace(sanitizeNextPath(searchParams.get("next")));
      router.refresh();
    } catch {
      setError("Account sign-in is not configured for this deployment yet. See docs/checkpoint-3/student-auth-and-sync.md.");
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-sm flex-col justify-center px-4 py-12">
      <h1 className="text-xl font-semibold text-foreground">Sign in</h1>
      <p className="mt-1 text-sm text-foreground-muted">
        An account is optional. You can keep using ScholarTrack as a guest without signing in — see{" "}
        <Link href="/workspace" className="underline">
          your workspace
        </Link>
        .
      </p>

      <form className="mt-6 flex flex-col gap-4" onSubmit={handleSubmit}>
        {error ? <Alert tone="danger">{error}</Alert> : null}

        <div>
          <Label htmlFor="student-email">Email</Label>
          <Input
            id="student-email"
            type="email"
            autoComplete="username"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>

        <div>
          <Label htmlFor="student-password">Password</Label>
          <Input
            id="student-password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>

        <Button type="submit" disabled={submitting}>
          {submitting ? "Signing in…" : "Sign in"}
        </Button>
      </form>

      <p className="mt-4 text-sm text-foreground-muted">
        Don&rsquo;t have an account?{" "}
        <Link href="/auth/signup" className="underline">
          Create one
        </Link>
      </p>
    </div>
  );
}
