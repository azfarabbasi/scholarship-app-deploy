"use client";

import { useState } from "react";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { HelpText, Input, Label } from "@/components/ui/Field";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export function ChangePasswordForm() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ tone: "success" | "danger"; text: string } | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);

    if (password.length < 8) {
      setMessage({ tone: "danger", text: "Password must be at least 8 characters." });
      return;
    }
    if (password !== confirmPassword) {
      setMessage({ tone: "danger", text: "Passwords do not match." });
      return;
    }

    setSubmitting(true);
    try {
      const supabase = createSupabaseBrowserClient();
      const { error } = await supabase.auth.updateUser({ password });
      if (error) {
        setMessage({ tone: "danger", text: error.message });
      } else {
        setMessage({ tone: "success", text: "Password updated." });
        setPassword("");
        setConfirmPassword("");
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
      {message ? <Alert tone={message.tone}>{message.text}</Alert> : null}

      <div>
        <Label htmlFor="new-password">New password</Label>
        <Input id="new-password" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
        <HelpText>At least 8 characters.</HelpText>
      </div>

      <div>
        <Label htmlFor="confirm-password">Confirm new password</Label>
        <Input id="confirm-password" type="password" autoComplete="new-password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
      </div>

      <Button type="submit" disabled={submitting} className="w-fit">
        {submitting ? "Updating…" : "Update password"}
      </Button>
    </form>
  );
}
