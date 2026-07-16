"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Checkbox, Input, Label, Select } from "@/components/ui/Field";
import { Skeleton } from "@/components/ui/Skeleton";
import { useLiveAnnouncer } from "@/components/common/LiveAnnouncer";
import { useCatalogue } from "@/hooks/useCatalogue";
import { usePreferences } from "@/hooks/usePreferences";
import { updatePlanningPreferences } from "@/lib/storage/preferences";
import { studyLevelSchema, type StudyLevel } from "@/lib/schemas/opportunity-seed";

const STUDY_LEVEL_OPTIONS = studyLevelSchema.options;
const INTAKE_TERMS = ["Autumn/Winter", "Spring/Summer", "Not sure yet"];

export function PlanningPreferencesForm() {
  const { preferences, loading } = usePreferences();
  const { items } = useCatalogue();
  const { announce } = useLiveAnnouncer();
  const countries = useMemo(
    () => [...new Set(items.flatMap((item) => item.opportunity.countries))].sort((a, b) => a.localeCompare(b)),
    [items],
  );

  const [graduationDate, setGraduationDate] = useState("");
  const [intakeYear, setIntakeYear] = useState("");
  const [intakeTerm, setIntakeTerm] = useState("");
  const [studyLevels, setStudyLevels] = useState<StudyLevel[]>([]);
  const [preferredCountries, setPreferredCountries] = useState<string[]>([]);

  // Load persisted preferences once, the first time they arrive from
  // IndexedDB. A one-time sync (rather than an effect keyed on
  // `preferences`) so it can never clobber the guest's in-progress edits if
  // preferences happen to refresh while this form is open.
  const [hasLoadedPreferences, setHasLoadedPreferences] = useState(false);
  if (!hasLoadedPreferences && preferences) {
    setHasLoadedPreferences(true);
    setGraduationDate(preferences.planning.expectedGraduationDate ?? "");
    setIntakeYear(preferences.planning.targetIntakeYear?.toString() ?? "");
    setIntakeTerm(preferences.planning.targetIntakeTerm ?? "");
    setStudyLevels(preferences.planning.preferredStudyLevels);
    setPreferredCountries(preferences.planning.preferredCountries);
  }

  if (loading || !preferences) {
    return <Skeleton className="h-64 w-full" />;
  }

  async function save() {
    await updatePlanningPreferences({
      expectedGraduationDate: graduationDate || null,
      targetIntakeYear: intakeYear ? Number(intakeYear) : null,
      targetIntakeTerm: intakeTerm || null,
      preferredStudyLevels: studyLevels,
      preferredCountries,
    });
    announce("Planning preferences saved.");
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-foreground-muted">
        These are used only for informational planning labels (e.g. &ldquo;Matches your preferred study
        level&rdquo;). They never determine formal eligibility.
      </p>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="pref-graduation">Expected graduation date</Label>
          <Input
            id="pref-graduation"
            type="date"
            value={graduationDate}
            onChange={(e) => setGraduationDate(e.target.value)}
          />
        </div>
        <div>
          <Label htmlFor="pref-intake-year">Target intake year</Label>
          <Input
            id="pref-intake-year"
            type="number"
            inputMode="numeric"
            min={2020}
            max={2100}
            value={intakeYear}
            onChange={(e) => setIntakeYear(e.target.value)}
          />
        </div>
      </div>

      <div>
        <Label htmlFor="pref-intake-term">Target intake term</Label>
        <Select id="pref-intake-term" value={intakeTerm} onChange={(e) => setIntakeTerm(e.target.value)}>
          <option value="">Not specified</option>
          {INTAKE_TERMS.map((term) => (
            <option key={term} value={term}>
              {term}
            </option>
          ))}
        </Select>
      </div>

      <fieldset>
        <legend className="text-sm font-medium text-foreground">Preferred study levels</legend>
        <div className="mt-2 flex flex-wrap gap-3">
          {STUDY_LEVEL_OPTIONS.map((level) => (
            <Checkbox
              key={level}
              id={`pref-level-${level}`}
              label={level}
              checked={studyLevels.includes(level)}
              onChange={() =>
                setStudyLevels((prev) => (prev.includes(level) ? prev.filter((l) => l !== level) : [...prev, level]))
              }
            />
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend className="text-sm font-medium text-foreground">Preferred countries</legend>
        <div className="mt-2 flex max-h-40 flex-wrap gap-3 overflow-y-auto">
          {countries.map((country) => (
            <Checkbox
              key={country}
              id={`pref-country-${country}`}
              label={country}
              checked={preferredCountries.includes(country)}
              onChange={() =>
                setPreferredCountries((prev) =>
                  prev.includes(country) ? prev.filter((c) => c !== country) : [...prev, country],
                )
              }
            />
          ))}
        </div>
      </fieldset>

      <div>
        <Button size="sm" onClick={() => void save()}>
          Save planning preferences
        </Button>
      </div>
    </div>
  );
}
