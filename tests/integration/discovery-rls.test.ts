import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import * as schema from "../../src/lib/db/schema";
import { asRole, client, db, expectRejectionMatching, uniqueSuffix } from "./helpers";

/**
 * RLS coverage for the five Checkpoint 4 discovery tables
 * (`user_saved_searches`, `user_eligibility_answers`, `user_reminder_preferences`,
 * `user_reminders`, `user_notifications`). Every one uses the same
 * owner-only policy as the Checkpoint 3 workspace tables — see
 * `src/lib/db/schema/discovery.ts` — and, distinctively, carries NO
 * staff-select policy at all: staff must never get casual read access to a
 * student's eligibility answers or discovery activity, so this file also
 * asserts that a staff role gets zero rows, not just that another student does.
 */
describe("discovery data row-level security", () => {
  const suffix = uniqueSuffix();
  const studentA = "77777777-7777-4777-8777-777777777777";
  const studentB = "88888888-8888-4888-8888-888888888888";
  const staffOnlyId = "99999999-9999-4999-8999-999999999999";

  beforeAll(async () => {
    await db
      .insert(schema.staffProfiles)
      .values({ id: staffOnlyId, email: `staff-only-${suffix}@example.test`, displayName: "Staff Only", status: "active" });
    await db.insert(schema.staffRoleAssignments).values({ staffProfileId: staffOnlyId, role: "reviewer" });

    await db
      .insert(schema.studentProfiles)
      .values([
        { id: studentA, email: `student-a-${suffix}@example.test` },
        { id: studentB, email: `student-b-${suffix}@example.test` },
      ]);
  });

  afterAll(async () => {
    await db.delete(schema.userSavedSearches).where(eq(schema.userSavedSearches.studentProfileId, studentA));
    await db.delete(schema.userEligibilityAnswers).where(eq(schema.userEligibilityAnswers.studentProfileId, studentA));
    await db.delete(schema.userReminderPreferences).where(eq(schema.userReminderPreferences.studentProfileId, studentA));
    await db.delete(schema.userReminders).where(eq(schema.userReminders.studentProfileId, studentA));
    await db.delete(schema.userNotifications).where(eq(schema.userNotifications.studentProfileId, studentA));
    await db.delete(schema.staffRoleAssignments).where(eq(schema.staffRoleAssignments.staffProfileId, staffOnlyId));
    await db.delete(schema.staffProfiles).where(eq(schema.staffProfiles.id, staffOnlyId));
    await db.delete(schema.studentProfiles).where(eq(schema.studentProfiles.id, studentA));
    await db.delete(schema.studentProfiles).where(eq(schema.studentProfiles.id, studentB));
    await client.end();
  });

  describe("user_saved_searches", () => {
    it("owner can create and read their own saved search", async () => {
      await asRole("authenticated", studentA, (tx) =>
        tx.insert(schema.userSavedSearches).values({ studentProfileId: studentA, name: "My search", queryText: "daad" }),
      );
      const own = await asRole("authenticated", studentA, (tx) => tx.select().from(schema.userSavedSearches));
      expect(own).toHaveLength(1);
    });

    it("another student cannot read it", async () => {
      const other = await asRole("authenticated", studentB, (tx) => tx.select().from(schema.userSavedSearches));
      expect(other).toHaveLength(0);
    });

    it("staff has no default read access to it either", async () => {
      const staffView = await asRole("authenticated", staffOnlyId, (tx) => tx.select().from(schema.userSavedSearches));
      expect(staffView).toHaveLength(0);
    });

    it("another student cannot update or delete it", async () => {
      const [row] = await db.select().from(schema.userSavedSearches).where(eq(schema.userSavedSearches.studentProfileId, studentA));
      await asRole("authenticated", studentB, (tx) =>
        tx.update(schema.userSavedSearches).set({ name: "Hijacked" }).where(eq(schema.userSavedSearches.id, row.id)),
      );
      await asRole("authenticated", studentB, (tx) => tx.delete(schema.userSavedSearches).where(eq(schema.userSavedSearches.id, row.id)));
      const [stillThere] = await db.select().from(schema.userSavedSearches).where(eq(schema.userSavedSearches.id, row.id));
      expect(stillThere.name).toBe("My search");
    });

    it("anon is denied at the grant level, not just filtered by RLS", async () => {
      await expectRejectionMatching(
        asRole("anon", null, (tx) => tx.select().from(schema.userSavedSearches)),
        /permission denied/i,
      );
    });
  });

  describe("user_eligibility_answers", () => {
    it("owner can upsert and read their own answers", async () => {
      await asRole("authenticated", studentA, (tx) =>
        tx.insert(schema.userEligibilityAnswers).values({ studentProfileId: studentA, nationality: "Germany" }),
      );
      const own = await asRole("authenticated", studentA, (tx) => tx.select().from(schema.userEligibilityAnswers));
      expect(own).toHaveLength(1);
      expect(own[0].nationality).toBe("Germany");
    });

    it("another student cannot read them, and staff cannot either", async () => {
      const other = await asRole("authenticated", studentB, (tx) => tx.select().from(schema.userEligibilityAnswers));
      expect(other).toHaveLength(0);
      const staffView = await asRole("authenticated", staffOnlyId, (tx) => tx.select().from(schema.userEligibilityAnswers));
      expect(staffView).toHaveLength(0);
    });

    it("another student cannot overwrite them", async () => {
      await asRole("authenticated", studentB, (tx) =>
        tx.update(schema.userEligibilityAnswers).set({ nationality: "France" }).where(eq(schema.userEligibilityAnswers.studentProfileId, studentA)),
      );
      const [row] = await db.select().from(schema.userEligibilityAnswers).where(eq(schema.userEligibilityAnswers.studentProfileId, studentA));
      expect(row.nationality).toBe("Germany");
    });

    it("anon is denied at the grant level", async () => {
      await expectRejectionMatching(
        asRole("anon", null, (tx) => tx.select().from(schema.userEligibilityAnswers)),
        /permission denied/i,
      );
    });
  });

  describe("user_reminder_preferences", () => {
    it("owner can upsert and read their own preferences", async () => {
      await asRole("authenticated", studentA, (tx) =>
        tx.insert(schema.userReminderPreferences).values({ studentProfileId: studentA, officialLeadDays: [14] }),
      );
      const own = await asRole("authenticated", studentA, (tx) => tx.select().from(schema.userReminderPreferences));
      expect(own).toHaveLength(1);
      expect(own[0].officialLeadDays).toEqual([14]);
    });

    it("another student cannot read or change them", async () => {
      const other = await asRole("authenticated", studentB, (tx) => tx.select().from(schema.userReminderPreferences));
      expect(other).toHaveLength(0);

      await asRole("authenticated", studentB, (tx) =>
        tx.update(schema.userReminderPreferences).set({ officialLeadDays: [0] }).where(eq(schema.userReminderPreferences.studentProfileId, studentA)),
      );
      const [row] = await db.select().from(schema.userReminderPreferences).where(eq(schema.userReminderPreferences.studentProfileId, studentA));
      expect(row.officialLeadDays).toEqual([14]);
    });

    it("anon is denied at the grant level", async () => {
      await expectRejectionMatching(
        asRole("anon", null, (tx) => tx.select().from(schema.userReminderPreferences)),
        /permission denied/i,
      );
    });
  });

  describe("user_reminders", () => {
    let reminderId: string;

    it("owner can create and read their own reminder", async () => {
      const [row] = await asRole("authenticated", studentA, (tx) =>
        tx
          .insert(schema.userReminders)
          .values({
            studentProfileId: studentA,
            stableKey: `official-deadline:opp-1:2027-03-01:7:${suffix}`,
            source: "official-deadline",
            title: "Official deadline",
            dueAt: new Date("2027-03-01T00:00:00Z"),
          })
          .returning(),
      );
      reminderId = row.id;
      const own = await asRole("authenticated", studentA, (tx) => tx.select().from(schema.userReminders));
      expect(own).toHaveLength(1);
    });

    it("another student cannot read, update, or delete it; staff cannot read it either", async () => {
      const other = await asRole("authenticated", studentB, (tx) => tx.select().from(schema.userReminders));
      expect(other).toHaveLength(0);
      const staffView = await asRole("authenticated", staffOnlyId, (tx) => tx.select().from(schema.userReminders));
      expect(staffView).toHaveLength(0);

      await asRole("authenticated", studentB, (tx) =>
        tx.update(schema.userReminders).set({ status: "dismissed" }).where(eq(schema.userReminders.id, reminderId)),
      );
      await asRole("authenticated", studentB, (tx) => tx.delete(schema.userReminders).where(eq(schema.userReminders.id, reminderId)));
      const [stillThere] = await db.select().from(schema.userReminders).where(eq(schema.userReminders.id, reminderId));
      expect(stillThere.status).toBe("pending");
    });

    it("enforces one row per (student, stableKey) — regenerating never duplicates a reminder", async () => {
      await expectRejectionMatching(
        asRole("authenticated", studentA, (tx) =>
          tx.insert(schema.userReminders).values({
            studentProfileId: studentA,
            stableKey: `official-deadline:opp-1:2027-03-01:7:${suffix}`,
            source: "official-deadline",
            title: "Official deadline (duplicate attempt)",
            dueAt: new Date("2027-03-01T00:00:00Z"),
          }),
        ),
        /duplicate key|unique constraint/i,
      );
    });

    it("anon is denied at the grant level", async () => {
      await expectRejectionMatching(
        asRole("anon", null, (tx) => tx.select().from(schema.userReminders)),
        /permission denied/i,
      );
    });
  });

  describe("user_notifications", () => {
    it("owner can create and read their own notification", async () => {
      await asRole("authenticated", studentA, (tx) =>
        tx.insert(schema.userNotifications).values({ studentProfileId: studentA, type: "system", title: "Hello" }),
      );
      const own = await asRole("authenticated", studentA, (tx) => tx.select().from(schema.userNotifications));
      expect(own).toHaveLength(1);
    });

    it("another student cannot read it, and staff cannot either", async () => {
      const other = await asRole("authenticated", studentB, (tx) => tx.select().from(schema.userNotifications));
      expect(other).toHaveLength(0);
      const staffView = await asRole("authenticated", staffOnlyId, (tx) => tx.select().from(schema.userNotifications));
      expect(staffView).toHaveLength(0);
    });

    it("anon is denied at the grant level", async () => {
      await expectRejectionMatching(
        asRole("anon", null, (tx) => tx.select().from(schema.userNotifications)),
        /permission denied/i,
      );
    });
  });
});
