"use client";

import { useEffect, useState } from "react";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Checkbox, Switch } from "@/components/ui/Field";
import { REMINDER_LEAD_DAY_OPTIONS } from "@/lib/storage/types";
import { getGuestReminderPreferences, setGuestReminderPreferences } from "@/lib/storage/reminders";
import { getMyReminderPreferences, updateMyReminderPreferences } from "@/lib/db/actions/student/reminders";

const LEAD_DAY_LABELS: Record<number, string> = {
  0: "Same day",
  1: "1 day before",
  3: "3 days before",
  7: "7 days before",
  14: "14 days before",
  30: "30 days before",
};

interface ReminderPreferencesFormProps {
  studentProfileId: string | null;
}

export function ReminderPreferencesForm({ studentProfileId }: ReminderPreferencesFormProps) {
  const [enabled, setEnabled] = useState(true);
  const [officialLeadDays, setOfficialLeadDays] = useState<number[]>([7]);
  const [personalLeadDays, setPersonalLeadDays] = useState<number[]>([1, 7]);
  const [savedSearchAlerts, setSavedSearchAlerts] = useState(true);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      if (studentProfileId) {
        const row = await getMyReminderPreferences();
        if (row) {
          setEnabled(row.remindersEnabled);
          setOfficialLeadDays(row.officialLeadDays);
          setPersonalLeadDays(row.personalLeadDays);
          setSavedSearchAlerts(row.savedSearchAlertsEnabled);
        }
      } else {
        const record = await getGuestReminderPreferences();
        setEnabled(record.remindersEnabled);
        setOfficialLeadDays(record.officialLeadDays);
        setPersonalLeadDays(record.personalLeadDays);
        setSavedSearchAlerts(record.savedSearchAlertsEnabled);
      }
      setLoading(false);
    }
    void load();
  }, [studentProfileId]);

  function toggleDay(list: number[], setList: (v: number[]) => void, day: number) {
    setList(list.includes(day) ? list.filter((d) => d !== day) : [...list, day]);
  }

  async function handleSave() {
    setMessage(null);
    const payload = { remindersEnabled: enabled, officialLeadDays, personalLeadDays, savedSearchAlertsEnabled: savedSearchAlerts };
    if (studentProfileId) {
      await updateMyReminderPreferences(payload);
      setMessage("Saved to your account.");
    } else {
      await setGuestReminderPreferences(payload);
      setMessage("Saved on this device.");
    }
  }

  if (loading) return <p className="text-sm text-foreground-muted">Loading…</p>;

  return (
    <div className="flex flex-col gap-4">
      {message ? <Alert tone="success">{message}</Alert> : null}

      <Switch id="reminders-enabled" label="Enable reminders" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />

      <fieldset>
        <legend className="text-sm font-medium text-foreground">Official deadline reminders</legend>
        <p className="text-xs text-foreground-muted">
          Only ever created for an exact, verified, single deadline date — never for rolling, estimated, or unclear
          deadlines.
        </p>
        <div className="mt-2 flex flex-wrap gap-3">
          {REMINDER_LEAD_DAY_OPTIONS.map((day) => (
            <Checkbox
              key={day}
              id={`official-lead-${day}`}
              label={LEAD_DAY_LABELS[day]}
              checked={officialLeadDays.includes(day)}
              onChange={() => toggleDay(officialLeadDays, setOfficialLeadDays, day)}
            />
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend className="text-sm font-medium text-foreground">Personal deadline reminders</legend>
        <p className="text-xs text-foreground-muted">Based on the personal deadline you set yourself — always honoured.</p>
        <div className="mt-2 flex flex-wrap gap-3">
          {REMINDER_LEAD_DAY_OPTIONS.map((day) => (
            <Checkbox
              key={day}
              id={`personal-lead-${day}`}
              label={LEAD_DAY_LABELS[day]}
              checked={personalLeadDays.includes(day)}
              onChange={() => toggleDay(personalLeadDays, setPersonalLeadDays, day)}
            />
          ))}
        </div>
      </fieldset>

      <Switch
        id="saved-search-alerts-enabled"
        label="Notify me about saved-search alerts"
        checked={savedSearchAlerts}
        onChange={(e) => setSavedSearchAlerts(e.target.checked)}
      />

      <Button className="w-fit" onClick={() => void handleSave()}>
        Save reminder preferences
      </Button>
    </div>
  );
}
