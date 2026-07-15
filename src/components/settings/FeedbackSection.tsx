"use client";

import { useState } from "react";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Label, Textarea } from "@/components/ui/Field";
import { useLiveAnnouncer } from "@/components/common/LiveAnnouncer";

const FEEDBACK_EMAIL = process.env.NEXT_PUBLIC_FEEDBACK_EMAIL;

export function FeedbackSection() {
  const [message, setMessage] = useState("");
  const { announce } = useLiveAnnouncer();

  const formatted = `ScholarTrack feedback\n---\n${message.trim() || "(no message entered)"}\n---`;

  async function copyFeedback() {
    try {
      await navigator.clipboard.writeText(formatted);
      announce("Feedback text copied to clipboard.");
    } catch {
      announce("Could not copy automatically. Select and copy the text manually.");
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-foreground-muted">
        ScholarTrack doesn&rsquo;t have a feedback backend yet — nothing is submitted automatically. Write your
        feedback below, then copy it or send it by email.
      </p>
      <div>
        <Label htmlFor="feedback-message">Your feedback</Label>
        <Textarea
          id="feedback-message"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="What's working well? What's confusing or broken?"
        />
      </div>
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" onClick={() => void copyFeedback()}>
          Copy feedback text
        </Button>
        {FEEDBACK_EMAIL ? (
          <Button size="sm" asChild>
            <a
              href={`mailto:${FEEDBACK_EMAIL}?subject=${encodeURIComponent("ScholarTrack feedback")}&body=${encodeURIComponent(formatted)}`}
            >
              Email feedback
            </a>
          </Button>
        ) : null}
      </div>
      {!FEEDBACK_EMAIL ? (
        <Alert tone="info">
          No feedback email is configured for this deployment. Use &ldquo;Copy feedback text&rdquo; instead.
        </Alert>
      ) : null}
    </div>
  );
}
