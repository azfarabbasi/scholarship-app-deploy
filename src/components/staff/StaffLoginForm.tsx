"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";
import { Input, Label } from "@/components/ui/Field";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

/** Only ever redirect to a same-origin, `/staff`-scoped path — never an open redirect. */
function sanitizeNextPath(path: string | null): string {
  if (!path || !path.startsWith("/staff") || path.startsWith("//") || path.includes("://")) {
    return "/staff";
  }
  return path;
}

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

      router.replace(sanitizeNextPath(searchParams.get("next")));
      router.refresh();
    } catch {
      setError(
        "Staff sign-in is not configured for this deployment yet. See docs/checkpoint-2/supabase-setup.md.",
      );
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-sm flex-col justify-center px-4 py-12">
      <h1 className="text-xl font-semibold text-foreground">Staff sign-in</h1>
      <p className="mt-1 text-sm text-foreground-muted">
        This is a staff-only area. There is no public registration — staff accounts are created by an
        administrator.
      </p>

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
  );
}
