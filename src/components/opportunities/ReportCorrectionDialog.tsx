"use client";

import { Flag } from "lucide-react";
import { useState, type FormEvent } from "react";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/Dialog";
import { HelpText, Input, Label, Select, Textarea } from "@/components/ui/Field";
import { trackEvent } from "@/lib/analytics";
import { CORRECTION_CATEGORIES, CORRECTION_CATEGORY_LABELS } from "@/lib/schemas/correction-report";

export function ReportCorrectionDialog({ opportunityId }: { opportunityId: string }) {
  const [category, setCategory] = useState<(typeof CORRECTION_CATEGORIES)[number]>("incorrect-deadline");
  const [description, setDescription] = useState("");
  const [suggestedOfficialSourceUrl, setSuggestedOfficialSourceUrl] = useState("");
  const [reporterContactEmail, setReporterContactEmail] = useState("");
  const [honeypot, setHoneypot] = useState("");
  const [status, setStatus] = useState<"idle" | "submitting" | "done" | "error" | "rate-limited">("idle");

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setStatus("submitting");
    try {
      const response = await fetch("/api/correction-reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          opportunityId,
          category,
          description,
          suggestedOfficialSourceUrl: suggestedOfficialSourceUrl || undefined,
          reporterContactEmail: reporterContactEmail || undefined,
          honeypot,
        }),
      });
      if (response.ok) {
        setStatus("done");
        trackEvent("correction_report_submitted", { category });
      } else if (response.status === 429) {
        setStatus("rate-limited");
      } else {
        setStatus("error");
      }
    } catch {
      setStatus("error");
    }
  }

  return (
    <Dialog
      onOpenChange={(open) => {
        if (open) trackEvent("correction_report_opened");
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Flag className="h-4 w-4" aria-hidden="true" /> Report incorrect information
        </Button>
      </DialogTrigger>
      <DialogContent title="Report incorrect information" description="Staff review every report before anything on the public listing changes.">
        {status === "done" ? (
          <Alert tone="success">Thanks — your report has been submitted for review.</Alert>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-3">
            {status === "error" ? <Alert tone="danger">Could not submit your report. Please try again.</Alert> : null}
            {status === "rate-limited" ? (
              <Alert tone="danger">You&rsquo;ve submitted a lot of reports from this browser today. Please try again tomorrow.</Alert>
            ) : null}

            <div>
              <Label htmlFor="correction-category">What&rsquo;s wrong?</Label>
              <Select
                id="correction-category"
                value={category}
                onChange={(e) => setCategory(e.target.value as (typeof CORRECTION_CATEGORIES)[number])}
              >
                {CORRECTION_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {CORRECTION_CATEGORY_LABELS[c]}
                  </option>
                ))}
              </Select>
            </div>

            <div>
              <Label htmlFor="correction-description">Details</Label>
              <Textarea
                id="correction-description"
                required
                minLength={10}
                maxLength={2000}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>

            <div>
              <Label htmlFor="correction-source">Suggested official source URL (optional)</Label>
              <Input
                id="correction-source"
                type="url"
                value={suggestedOfficialSourceUrl}
                onChange={(e) => setSuggestedOfficialSourceUrl(e.target.value)}
              />
            </div>

            <div>
              <Label htmlFor="correction-email">Your email, if you&rsquo;d like a reply (optional)</Label>
              <Input
                id="correction-email"
                type="email"
                value={reporterContactEmail}
                onChange={(e) => setReporterContactEmail(e.target.value)}
              />
              <HelpText>We never publish or sell this address; it is used only to follow up on this report.</HelpText>
            </div>

            <div className="hidden" aria-hidden="true">
              <label htmlFor="correction-website">Leave this field blank</label>
              <input
                id="correction-website"
                name="website"
                tabIndex={-1}
                autoComplete="off"
                value={honeypot}
                onChange={(e) => setHoneypot(e.target.value)}
              />
            </div>

            <Button type="submit" disabled={status === "submitting"}>
              {status === "submitting" ? "Submitting…" : "Submit report"}
            </Button>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
