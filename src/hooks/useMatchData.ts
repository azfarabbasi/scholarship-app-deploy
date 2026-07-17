"use client";

import { useEffect, useState } from "react";
import { EMPTY_ELIGIBILITY_ANSWERS, resolveAnswers, type EligibilityAnswers } from "@/lib/schemas/eligibility-answers";
import { DEFAULT_PLANNING_PREFERENCES, type PlanningPreferences } from "@/lib/storage/types";
import { getGuestEligibilityAnswers } from "@/lib/storage/eligibility";
import { getPreferences } from "@/lib/storage/preferences";
import { getMyEligibilityAnswers } from "@/lib/db/actions/student/eligibility";
import { getMyPlanningPreferences } from "@/lib/db/actions/student/preferences";

/** Loads the data the deterministic matching engine needs — guest-local or cloud, whichever applies. */
export function useMatchData(studentProfileId: string | null): {
  answers: EligibilityAnswers;
  planning: PlanningPreferences;
  loading: boolean;
} {
  const [answers, setAnswers] = useState<EligibilityAnswers>(EMPTY_ELIGIBILITY_ANSWERS);
  const [planning, setPlanning] = useState<PlanningPreferences>(DEFAULT_PLANNING_PREFERENCES);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      if (studentProfileId) {
        const [answersRow, planningRow] = await Promise.all([getMyEligibilityAnswers(), getMyPlanningPreferences()]);
        if (answersRow) {
          setAnswers(
            resolveAnswers({
              countryOfResidence: answersRow.countryOfResidence,
              nationality: answersRow.nationality,
              currentStudyLevel: answersRow.currentStudyLevel,
              intendedStudyLevel: answersRow.intendedStudyLevel,
              fieldsOfInterest: answersRow.fieldsOfInterest,
              graduationYear: answersRow.graduationYear,
              targetIntakeYear: answersRow.targetIntakeYear,
              targetIntakeTerm: answersRow.targetIntakeTerm,
              preferredCountries: answersRow.preferredCountries,
              preferredRegions: answersRow.preferredRegions,
              languageTestStatus: answersRow.languageTestStatus as EligibilityAnswers["languageTestStatus"],
              researchExperience: answersRow.researchExperience as EligibilityAnswers["researchExperience"],
              workExperienceYears: answersRow.workExperienceYears,
              finalYearStatus: answersRow.finalYearStatus as EligibilityAnswers["finalYearStatus"],
              fundingPreference: answersRow.fundingPreference as EligibilityAnswers["fundingPreference"],
              studyMode: answersRow.studyMode as EligibilityAnswers["studyMode"],
            }),
          );
        }
        if (planningRow) {
          setPlanning({
            expectedGraduationDate: planningRow.expectedGraduationDate,
            targetIntakeYear: planningRow.targetIntakeYear,
            targetIntakeTerm: planningRow.targetIntakeTerm,
            preferredStudyLevels: planningRow.preferredStudyLevels as PlanningPreferences["preferredStudyLevels"],
            preferredCountries: planningRow.preferredCountries,
          });
        }
      } else {
        const [answersRecord, preferencesRecord] = await Promise.all([getGuestEligibilityAnswers(), getPreferences()]);
        setAnswers(resolveAnswers(answersRecord.answers));
        setPlanning(preferencesRecord.planning);
      }
      setLoading(false);
    }
    void load();
  }, [studentProfileId]);

  return { answers, planning, loading };
}
