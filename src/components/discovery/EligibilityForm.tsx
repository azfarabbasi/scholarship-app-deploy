"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { HelpText, Input, Label, Select } from "@/components/ui/Field";
import {
  FUNDING_PREFERENCE_OPTIONS,
  LANGUAGE_TEST_STATUS_OPTIONS,
  STUDY_MODE_OPTIONS,
  YES_NO_UNKNOWN_OPTIONS,
  type EligibilityAnswersInput,
} from "@/lib/schemas/eligibility-answers";
import { getGuestEligibilityAnswers, setGuestEligibilityAnswers } from "@/lib/storage/eligibility";
import { getMyEligibilityAnswers, updateMyEligibilityAnswers } from "@/lib/db/actions/student/eligibility";

interface EligibilityFormProps {
  studentProfileId: string | null;
}

function toCommaList(values: readonly string[]): string {
  return values.join(", ");
}
function fromCommaList(value: string): string[] {
  return value.split(",").map((v) => v.trim()).filter(Boolean);
}

const emptyAnswers: EligibilityAnswersInput = { fieldsOfInterest: [], preferredCountries: [], preferredRegions: [] };

export function EligibilityForm({ studentProfileId }: EligibilityFormProps) {
  const [answers, setAnswers] = useState<EligibilityAnswersInput>(emptyAnswers);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ tone: "success" | "danger"; text: string } | null>(null);

  useEffect(() => {
    async function load() {
      if (studentProfileId) {
        const row = await getMyEligibilityAnswers();
        if (row) {
          setAnswers({
            countryOfResidence: row.countryOfResidence,
            nationality: row.nationality,
            currentStudyLevel: row.currentStudyLevel,
            intendedStudyLevel: row.intendedStudyLevel,
            fieldsOfInterest: row.fieldsOfInterest,
            graduationYear: row.graduationYear,
            targetIntakeYear: row.targetIntakeYear,
            targetIntakeTerm: row.targetIntakeTerm,
            preferredCountries: row.preferredCountries,
            preferredRegions: row.preferredRegions,
            languageTestStatus: row.languageTestStatus as EligibilityAnswersInput["languageTestStatus"],
            researchExperience: row.researchExperience as EligibilityAnswersInput["researchExperience"],
            workExperienceYears: row.workExperienceYears,
            finalYearStatus: row.finalYearStatus as EligibilityAnswersInput["finalYearStatus"],
            fundingPreference: row.fundingPreference as EligibilityAnswersInput["fundingPreference"],
            studyMode: row.studyMode as EligibilityAnswersInput["studyMode"],
          });
        }
      } else {
        const record = await getGuestEligibilityAnswers();
        setAnswers(record.answers);
      }
      setLoading(false);
    }
    void load();
  }, [studentProfileId]);

  function update<K extends keyof EligibilityAnswersInput>(key: K, value: EligibilityAnswersInput[K]) {
    setAnswers((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMessage(null);

    if (studentProfileId) {
      const result = await updateMyEligibilityAnswers(answers);
      setMessage(result.ok ? { tone: "success", text: "Saved to your account." } : { tone: "danger", text: result.error ?? "Could not save." });
    } else {
      await setGuestEligibilityAnswers(answers);
      setMessage({ tone: "success", text: "Saved on this device." });
    }
    setSaving(false);
  }

  if (loading) {
    return <p className="text-sm text-foreground-muted">Loading…</p>;
  }

  return (
    <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
      {message ? <Alert tone={message.tone}>{message.text}</Alert> : null}

      <Alert tone="info">
        Every question below is optional. Answers are used only to compute the deterministic match labels shown
        throughout the catalogue — see{" "}
        <Link href="/privacy" className="underline">
          Privacy
        </Link>{" "}
        for what is never collected. {studentProfileId ? "These answers sync to your account." : "These answers stay on this device unless you create an account and choose to sync them."}
      </Alert>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="elig-residence">Country of residence</Label>
          <Input id="elig-residence" value={answers.countryOfResidence ?? ""} onChange={(e) => update("countryOfResidence", e.target.value || null)} />
          <HelpText>Optional — helps match residence-based eligibility rules.</HelpText>
        </div>
        <div>
          <Label htmlFor="elig-nationality">Nationality / citizenship</Label>
          <Input id="elig-nationality" value={answers.nationality ?? ""} onChange={(e) => update("nationality", e.target.value || null)} />
          <HelpText>Optional — only if you choose to share it.</HelpText>
        </div>
        <div>
          <Label htmlFor="elig-current-level">Current study level</Label>
          <Input id="elig-current-level" value={answers.currentStudyLevel ?? ""} onChange={(e) => update("currentStudyLevel", e.target.value || null)} />
        </div>
        <div>
          <Label htmlFor="elig-intended-level">Intended study level</Label>
          <Input id="elig-intended-level" value={answers.intendedStudyLevel ?? ""} onChange={(e) => update("intendedStudyLevel", e.target.value || null)} />
        </div>
        <div>
          <Label htmlFor="elig-graduation-year">Graduation year</Label>
          <Input
            id="elig-graduation-year"
            type="number"
            value={answers.graduationYear ?? ""}
            onChange={(e) => update("graduationYear", e.target.value ? Number(e.target.value) : null)}
          />
        </div>
        <div>
          <Label htmlFor="elig-intake-year">Target intake year</Label>
          <Input
            id="elig-intake-year"
            type="number"
            value={answers.targetIntakeYear ?? ""}
            onChange={(e) => update("targetIntakeYear", e.target.value ? Number(e.target.value) : null)}
          />
        </div>
        <div>
          <Label htmlFor="elig-intake-term">Target intake term</Label>
          <Input id="elig-intake-term" placeholder="e.g. Fall" value={answers.targetIntakeTerm ?? ""} onChange={(e) => update("targetIntakeTerm", e.target.value || null)} />
        </div>
        <div>
          <Label htmlFor="elig-work-years">Work experience (years)</Label>
          <Input
            id="elig-work-years"
            type="number"
            value={answers.workExperienceYears ?? ""}
            onChange={(e) => update("workExperienceYears", e.target.value ? Number(e.target.value) : null)}
          />
        </div>
      </div>

      <div>
        <Label htmlFor="elig-fields">Fields / disciplines of interest</Label>
        <Input id="elig-fields" value={toCommaList(answers.fieldsOfInterest)} onChange={(e) => update("fieldsOfInterest", fromCommaList(e.target.value))} placeholder="Computer science, Public health, ..." />
        <HelpText>Comma-separated.</HelpText>
      </div>

      <div>
        <Label htmlFor="elig-countries">Preferred countries/regions</Label>
        <Input id="elig-countries" value={toCommaList(answers.preferredCountries)} onChange={(e) => update("preferredCountries", fromCommaList(e.target.value))} />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="elig-language-test">Language-test status</Label>
          <Select id="elig-language-test" value={answers.languageTestStatus ?? ""} onChange={(e) => update("languageTestStatus", (e.target.value || null) as EligibilityAnswersInput["languageTestStatus"])}>
            <option value="">Prefer not to say</option>
            {LANGUAGE_TEST_STATUS_OPTIONS.map((opt) => (
              <option key={opt} value={opt}>
                {opt.replace(/-/g, " ")}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor="elig-research">Research experience</Label>
          <Select id="elig-research" value={answers.researchExperience ?? ""} onChange={(e) => update("researchExperience", (e.target.value || null) as EligibilityAnswersInput["researchExperience"])}>
            <option value="">Prefer not to say</option>
            {YES_NO_UNKNOWN_OPTIONS.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor="elig-final-year">Final-year status</Label>
          <Select id="elig-final-year" value={answers.finalYearStatus ?? ""} onChange={(e) => update("finalYearStatus", (e.target.value || null) as EligibilityAnswersInput["finalYearStatus"])}>
            <option value="">Prefer not to say</option>
            {YES_NO_UNKNOWN_OPTIONS.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor="elig-funding">Funding preference</Label>
          <Select id="elig-funding" value={answers.fundingPreference ?? ""} onChange={(e) => update("fundingPreference", (e.target.value || null) as EligibilityAnswersInput["fundingPreference"])}>
            <option value="">No preference</option>
            {FUNDING_PREFERENCE_OPTIONS.map((opt) => (
              <option key={opt} value={opt}>
                {opt.replace(/-/g, " ")}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor="elig-study-mode">Study mode preference</Label>
          <Select id="elig-study-mode" value={answers.studyMode ?? ""} onChange={(e) => update("studyMode", (e.target.value || null) as EligibilityAnswersInput["studyMode"])}>
            <option value="">No preference</option>
            {STUDY_MODE_OPTIONS.map((opt) => (
              <option key={opt} value={opt}>
                {opt.replace(/-/g, " ")}
              </option>
            ))}
          </Select>
        </div>
      </div>

      <Button type="submit" disabled={saving} className="w-fit">
        {saving ? "Saving…" : "Save answers"}
      </Button>
    </form>
  );
}
