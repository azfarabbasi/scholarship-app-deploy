import type { EligibilityAnswersInput } from "@/lib/schemas/eligibility-answers";
import { getDb } from "./db";
import { emitStorageChange } from "./events";
import { defaultEligibilityAnswersRecord, type EligibilityAnswersRecord } from "./types";

const SINGLETON_ID = "singleton" as const;

export async function getGuestEligibilityAnswers(): Promise<EligibilityAnswersRecord> {
  const db = await getDb();
  const existing = await db.get("eligibilityAnswers", SINGLETON_ID);
  return existing ?? defaultEligibilityAnswersRecord();
}

export async function setGuestEligibilityAnswers(answers: EligibilityAnswersInput): Promise<EligibilityAnswersRecord> {
  const db = await getDb();
  const record: EligibilityAnswersRecord = { id: SINGLETON_ID, answers, updatedAt: new Date().toISOString() };
  await db.put("eligibilityAnswers", record);
  emitStorageChange("eligibilityAnswers");
  return record;
}

export async function clearGuestEligibilityAnswers(): Promise<void> {
  const db = await getDb();
  await db.delete("eligibilityAnswers", SINGLETON_ID);
  emitStorageChange("eligibilityAnswers");
}
