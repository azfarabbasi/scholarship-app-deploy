"use client";

import { useState } from "react";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { HelpText, Input, Label } from "@/components/ui/Field";
import { updateMyProfile } from "@/lib/db/actions/student/profile";
import type { schema } from "@/lib/db/client";

type StudentProfileRow = typeof schema.studentProfiles.$inferSelect;

interface ProfileFormProps {
  profile: StudentProfileRow | null;
}

function toCommaList(values: readonly string[]): string {
  return values.join(", ");
}

function fromCommaList(value: string): string[] {
  return value
    .split(",")
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
}

export function ProfileForm({ profile }: ProfileFormProps) {
  const [displayName, setDisplayName] = useState(profile?.displayName ?? "");
  const [countryOrRegion, setCountryOrRegion] = useState(profile?.countryOrRegion ?? "");
  const [currentStudyLevel, setCurrentStudyLevel] = useState(profile?.currentStudyLevel ?? "");
  const [intendedStudyLevel, setIntendedStudyLevel] = useState(profile?.intendedStudyLevel ?? "");
  const [graduationYear, setGraduationYear] = useState(profile?.graduationYear?.toString() ?? "");
  const [targetIntakeYear, setTargetIntakeYear] = useState(profile?.targetIntakeYear?.toString() ?? "");
  const [targetIntakeTerm, setTargetIntakeTerm] = useState(profile?.targetIntakeTerm ?? "");
  const [preferredCountries, setPreferredCountries] = useState(toCommaList(profile?.preferredCountries ?? []));
  const [preferredStudyLevels, setPreferredStudyLevels] = useState(toCommaList(profile?.preferredStudyLevels ?? []));
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ tone: "success" | "danger"; text: string } | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMessage(null);

    const result = await updateMyProfile({
      displayName: displayName || null,
      countryOrRegion: countryOrRegion || null,
      currentStudyLevel: currentStudyLevel || null,
      intendedStudyLevel: intendedStudyLevel || null,
      graduationYear: graduationYear ? Number(graduationYear) : null,
      targetIntakeYear: targetIntakeYear ? Number(targetIntakeYear) : null,
      targetIntakeTerm: targetIntakeTerm || null,
      preferredCountries: fromCommaList(preferredCountries),
      preferredStudyLevels: fromCommaList(preferredStudyLevels),
    });

    setSaving(false);
    setMessage(
      result.ok
        ? { tone: "success", text: "Profile saved." }
        : { tone: "danger", text: result.error ?? "Could not save your profile." },
    );
  }

  return (
    <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
      {message ? <Alert tone={message.tone}>{message.text}</Alert> : null}

      <p className="text-xs text-foreground-muted">
        Every field here is optional. We never ask for a date of birth, passport, phone number, full address,
        financial details, or medical information.
      </p>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="profile-display-name">Display name</Label>
          <Input id="profile-display-name" value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
        </div>
        <div>
          <Label htmlFor="profile-country">Country / region</Label>
          <Input id="profile-country" value={countryOrRegion} onChange={(e) => setCountryOrRegion(e.target.value)} />
        </div>
        <div>
          <Label htmlFor="profile-current-level">Current study level</Label>
          <Input id="profile-current-level" value={currentStudyLevel} onChange={(e) => setCurrentStudyLevel(e.target.value)} />
        </div>
        <div>
          <Label htmlFor="profile-intended-level">Intended study level</Label>
          <Input id="profile-intended-level" value={intendedStudyLevel} onChange={(e) => setIntendedStudyLevel(e.target.value)} />
        </div>
        <div>
          <Label htmlFor="profile-graduation-year">Graduation year</Label>
          <Input
            id="profile-graduation-year"
            type="number"
            inputMode="numeric"
            value={graduationYear}
            onChange={(e) => setGraduationYear(e.target.value)}
          />
        </div>
        <div>
          <Label htmlFor="profile-intake-year">Target intake year</Label>
          <Input
            id="profile-intake-year"
            type="number"
            inputMode="numeric"
            value={targetIntakeYear}
            onChange={(e) => setTargetIntakeYear(e.target.value)}
          />
        </div>
        <div>
          <Label htmlFor="profile-intake-term">Target intake term</Label>
          <Input id="profile-intake-term" placeholder="e.g. Fall" value={targetIntakeTerm} onChange={(e) => setTargetIntakeTerm(e.target.value)} />
        </div>
      </div>

      <div>
        <Label htmlFor="profile-preferred-countries">Preferred countries/regions</Label>
        <Input
          id="profile-preferred-countries"
          value={preferredCountries}
          onChange={(e) => setPreferredCountries(e.target.value)}
          placeholder="Germany, Netherlands, ..."
        />
        <HelpText>Comma-separated.</HelpText>
      </div>

      <div>
        <Label htmlFor="profile-preferred-levels">Preferred study levels</Label>
        <Input
          id="profile-preferred-levels"
          value={preferredStudyLevels}
          onChange={(e) => setPreferredStudyLevels(e.target.value)}
          placeholder="master, phd, ..."
        />
        <HelpText>Comma-separated.</HelpText>
      </div>

      <Button type="submit" disabled={saving} className="w-fit">
        {saving ? "Saving…" : "Save profile"}
      </Button>
    </form>
  );
}
