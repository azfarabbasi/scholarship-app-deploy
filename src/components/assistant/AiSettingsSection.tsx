"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/Dialog";
import { getMyAiHistoryEnabled, setMyAiHistoryEnabled, clearMyAiHistory } from "@/lib/db/actions/student/ai-assistant";
import { clearAllGuestAiHistory } from "@/lib/storage/ai-assistant";

interface AiSettingsSectionProps {
  studentProfileId: string | null;
}

export function AiSettingsSection({ studentProfileId }: AiSettingsSectionProps) {
  const [historyEnabled, setHistoryEnabled] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [guestCleared, setGuestCleared] = useState(false);

  useEffect(() => {
    if (!studentProfileId) return;
    async function load() {
      const enabled = await getMyAiHistoryEnabled();
      setHistoryEnabled(enabled);
      setLoaded(true);
    }
    void load();
  }, [studentProfileId]);

  async function toggleHistory(next: boolean) {
    setBusy(true);
    setMessage(null);
    const result = await setMyAiHistoryEnabled(next);
    if (result.ok) {
      setHistoryEnabled(next);
      setMessage(next ? "AI conversation history is now saved to your account." : "AI history is off — any previously saved conversations were cleared.");
    } else {
      setMessage(result.error ?? "Something went wrong.");
    }
    setBusy(false);
  }

  async function handleClearCloudHistory() {
    setBusy(true);
    const result = await clearMyAiHistory();
    setMessage(result.ok ? "Cloud AI history cleared." : (result.error ?? "Something went wrong."));
    setBusy(false);
  }

  async function handleClearGuestHistory() {
    setBusy(true);
    await clearAllGuestAiHistory();
    setGuestCleared(true);
    setBusy(false);
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-base font-semibold text-foreground">Assistant privacy</h2>
        <p className="mt-1 text-sm text-foreground-muted">
          The assistant answers only from ScholarTrack&apos;s stored source data — never live web browsing — and always
          includes citations. It is not a final eligibility, admission, or funding decision. Avoid pasting sensitive
          documents (passports, transcripts, financial or health information) into any message.
        </p>
      </div>

      {message ? <Alert tone="info">{message}</Alert> : null}

      {studentProfileId ? (
        <div className="flex flex-col gap-4 rounded-lg border border-border p-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-foreground">Save AI conversation history to my account</p>
              <p className="mt-0.5 text-xs text-foreground-muted">
                Off by default. When off, your questions and answers are never stored server-side and feedback isn&apos;t
                available (there is no saved message to attach it to).
              </p>
            </div>
            <label className="relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center">
              <input
                type="checkbox"
                checked={historyEnabled}
                disabled={!loaded || busy}
                onChange={(event) => void toggleHistory(event.target.checked)}
                className="peer sr-only"
              />
              <span className="absolute inset-0 rounded-full bg-surface-muted transition-colors peer-checked:bg-brand" />
              <span className="absolute left-0.5 h-5 w-5 rounded-full bg-white transition-transform peer-checked:translate-x-5" />
            </label>
          </div>

          {historyEnabled ? (
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm" disabled={busy} className="self-start">
                  Clear cloud AI history
                </Button>
              </DialogTrigger>
              <DialogContent title="Clear cloud AI history?" description="This permanently deletes every saved assistant conversation on your account.">
                <div className="flex justify-end gap-2 pt-2">
                  <Button variant="ghost" size="sm" onClick={() => void handleClearCloudHistory()}>
                    Clear history
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          ) : null}

          <p className="text-xs text-foreground-subtle">
            Your full account export (including AI history when enabled) and account deletion are on the{" "}
            <Link href="/account/data" className="text-brand hover:underline">
              account data
            </Link>{" "}
            and{" "}
            <Link href="/account/delete" className="text-brand hover:underline">
              delete account
            </Link>{" "}
            pages.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-3 rounded-lg border border-border p-4">
          <p className="text-sm font-medium text-foreground">Guest assistant history</p>
          <p className="text-xs text-foreground-muted">
            As a guest, your conversations are stored only on this device (never uploaded) unless you use a temporary
            chat, in which case nothing is stored at all. Sign in to optionally sync history to your account.
          </p>
          {guestCleared ? (
            <p className="text-xs text-success">Local AI history cleared.</p>
          ) : (
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm" disabled={busy} className="self-start">
                  Clear local AI history
                </Button>
              </DialogTrigger>
              <DialogContent title="Clear local AI history?" description="This permanently deletes every assistant conversation stored on this device.">
                <div className="flex justify-end gap-2 pt-2">
                  <Button variant="ghost" size="sm" onClick={() => void handleClearGuestHistory()}>
                    Clear history
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          )}
        </div>
      )}
    </div>
  );
}
