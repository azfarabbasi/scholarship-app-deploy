"use client";

import { ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";
import { Input, Label } from "@/components/ui/Field";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { sanitizeRedirectPath } from "@/lib/security/redirect";

export function StaffLoginForm() {
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
        setError("Sign-in failed. Check your email and password and try again.");
        setSubmitting(false);
        return;
      }

      router.replace(sanitizeRedirectPath(searchParams.get("next"), window.location.origin, "/staff", { requiredPrefix: "/staff" }));
      router.refresh();
    } catch {
      setError(
        "Staff sign-in is not configured for this deployment yet. See docs/checkpoint-2/supabase-setup.md.",
      );
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-[70vh] w-full max-w-md flex-col justify-center px-4 py-12">
      <div className="rounded-xl border border-border bg-surface p-6 shadow-e2 sm:p-8">
        <div className="flex flex-col items-center text-center">
          <span
            aria-hidden="true"
            className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand text-brand-foreground shadow-e1"
          >
            <ShieldCheck className="h-6 w-6" />
          </span>
          <h1 className="mt-4 text-xl font-semibold tracking-tight text-foreground">Staff sign-in</h1>
          <p className="mt-2 text-sm leading-relaxed text-foreground-muted">
            This is a staff-only area. There is no public registration — staff accounts are created by an
            administrator.
          </p>
        </div>

        <form className="mt-6 flex flex-col gap-4" onSubmit={handleSubmit}>
          {error ? <Alert tone="danger">{error}</Alert> : null}

          <div>
            <Label htmlFor="staff-email">Email</Label>
            <Input
              id="staff-email"
              type="email"
              autoComplete="username"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div>
            <Label htmlFor="staff-password">Password</Label>
            <Input
              id="staff-password"
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
      </div>

      <p className="mt-4 text-center text-sm text-foreground-muted">
        Looking for your own applications?{" "}
        <Link href="/auth/login" className="font-medium text-brand hover:underline">
          Student sign-in
        </Link>
      </p>
    </div>
  );
}
