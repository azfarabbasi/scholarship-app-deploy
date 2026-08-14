"use client";

import { ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
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

  const [showReset, setShowReset] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [resetSubmitting, setResetSubmitting] = useState(false);
  const [resetMessage, setResetMessage] = useState<{ tone: "success" | "danger"; text: string } | null>(null);

  const [checkingHashSession, setCheckingHashSession] = useState(true);

  // Admin-generated links (`supabase.auth.admin.generateLink`) deliver the
  // session as a `#access_token=...` URL fragment (implicit flow), never as
  // a `?code=` query param — fragments never reach the server, so
  // `/staff/auth/callback` can't see them at all. The Supabase browser
  // client parses that fragment itself, but only once instantiated; nothing
  // on this page created one until a form was submitted, so the token just
  // sat in the URL unprocessed. Creating the client on mount makes it detect
  // and consume the fragment automatically, then we finish the redirect
  // ourselves.
  useEffect(() => {
    if (typeof window === "undefined" || !window.location.hash.includes("access_token")) {
      setCheckingHashSession(false);
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const supabase = createSupabaseBrowserClient();
        // `getSession()` can hang indefinitely if the browser's cross-tab
        // session lock is contended (e.g. another tab is mid-way through its
        // own auth-state processing) — never let that strand the user on a
        // permanent "Signing you in…" screen. If it doesn't resolve quickly,
        // fall back to the normal form; the session, if established, is
        // already persisted and a plain sign-in/reload will pick it up.
        const timeout = new Promise<null>((resolve) => setTimeout(() => resolve(null), 5000));
        const result = await Promise.race([supabase.auth.getSession(), timeout]);
        if (cancelled) return;
        if (result?.data.session) {
          router.replace(sanitizeRedirectPath(searchParams.get("next"), window.location.origin, "/account/security"));
          return;
        }
      } finally {
        if (!cancelled) setCheckingHashSession(false);
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleResetSubmit(e: React.FormEvent) {
    e.preventDefault();
    setResetSubmitting(true);
    setResetMessage(null);

    try {
      const supabase = createSupabaseBrowserClient();
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(resetEmail, {
        redirectTo: `${window.location.origin}/staff/auth/callback?next=/account/security`,
      });

      if (resetError) {
        setResetMessage({ tone: "danger", text: "Could not send a reset link. Try again in a moment." });
      } else {
        setResetMessage({
          tone: "success",
          text: "If a staff account exists for that email, a reset link has been sent. Open it in this same browser, then set a new password on the Security page it lands you on.",
        });
      }
    } finally {
      setResetSubmitting(false);
    }
  }

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

  if (checkingHashSession) {
    return (
      <div className="mx-auto flex min-h-[70vh] w-full max-w-md flex-col items-center justify-center px-4 py-12 text-center text-sm text-foreground-muted">
        Signing you in…
      </div>
    );
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

          <button
            type="button"
            className="text-center text-sm font-medium text-brand hover:underline"
            onClick={() => {
              setShowReset((v) => !v);
              setResetMessage(null);
            }}
          >
            Forgot password?
          </button>
        </form>

        {showReset ? (
          <form className="mt-4 flex flex-col gap-4 border-t border-border pt-4" onSubmit={handleResetSubmit}>
            {resetMessage ? <Alert tone={resetMessage.tone}>{resetMessage.text}</Alert> : null}

            <div>
              <Label htmlFor="staff-reset-email">Email to send a reset link to</Label>
              <Input
                id="staff-reset-email"
                type="email"
                autoComplete="username"
                required
                value={resetEmail}
                onChange={(e) => setResetEmail(e.target.value)}
              />
            </div>

            <Button type="submit" disabled={resetSubmitting} variant="secondary">
              {resetSubmitting ? "Sending…" : "Send reset link"}
            </Button>
          </form>
        ) : null}
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
