"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";
import { Input, Label, HelpText } from "@/components/ui/Field";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export function StudentSignupForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checkEmail, setCheckEmail] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const supabase = createSupabaseBrowserClient();
      const origin = window.location.origin;
      const { data, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: `${origin}/auth/callback` },
      });

      if (signUpError) {
        setError(signUpError.message || "Could not create your account. Please try again.");
        setSubmitting(false);
        return;
      }

      if (data.session) {
        // Email confirmation is disabled for this deployment — sign-up
        // signed the user in immediately.
        router.replace("/account");
        router.refresh();
        return;
      }

      setCheckEmail(true);
      setSubmitting(false);
    } catch {
      setError("Account sign-up is not configured for this deployment yet. See docs/checkpoint-3/student-auth-and-sync.md.");
      setSubmitting(false);
    }
  }

  if (checkEmail) {
    return (
      <div className="mx-auto flex min-h-[70vh] max-w-sm flex-col justify-center px-4 py-12">
        <Alert tone="success" title="Check your email">
          We sent a confirmation link to {email}. Follow it to finish creating your account, then sign in.
        </Alert>
        <Button className="mt-4" variant="outline" asChild>
          <Link href="/auth/login">Go to sign in</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-sm flex-col justify-center px-4 py-12">
      <h1 className="text-xl font-semibold text-foreground">Create an account</h1>
      <p className="mt-1 text-sm text-foreground-muted">
        Optional — an account only adds cloud sync across devices. Your guest data stays put either way, and you
        choose whether to bring it into your account afterwards.
      </p>

      <form className="mt-6 flex flex-col gap-4" onSubmit={handleSubmit}>
        {error ? <Alert tone="danger">{error}</Alert> : null}

        <div>
          <Label htmlFor="signup-email">Email</Label>
          <Input
            id="signup-email"
            type="email"
            autoComplete="username"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>

        <div>
          <Label htmlFor="signup-password">Password</Label>
          <Input
            id="signup-password"
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <HelpText>At least 8 characters.</HelpText>
        </div>

        <Button type="submit" disabled={submitting}>
          {submitting ? "Creating account…" : "Create account"}
        </Button>
      </form>

      <p className="mt-4 text-sm text-foreground-muted">
        Already have an account?{" "}
        <Link href="/auth/login" className="underline">
          Sign in
        </Link>
      </p>
    </div>
  );
}
