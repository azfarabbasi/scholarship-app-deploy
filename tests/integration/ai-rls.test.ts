import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import * as schema from "../../src/lib/db/schema";
import { asRole, client, db, expectRejectionMatching, uniqueSuffix } from "./helpers";

describe("AI assistant row-level security", () => {
  const suffix = uniqueSuffix();
  const studentA = "77777777-7777-4777-a777-777777777777";
  const studentB = "88888888-8888-4888-a888-888888888888";
  const staffOnlyId = "99999999-9999-4999-a999-999999999999";

  let opportunityId: string;
  let approvedDocumentId: string;
  let approvedChunkId: string;
  let draftDocumentId: string;
  let draftChunkId: string;
  let conversationAId: string;
  let messageAId: string;

  beforeAll(async () => {
    const [opportunityType] = await db.select().from(schema.opportunityTypes).where(eq(schema.opportunityTypes.code, "scholarship"));
    if (!opportunityType) {
      throw new Error("Taxonomies are not seeded. Run `npm run db:seed:taxonomies` against the test database first.");
    }

    const [organisation] = await db
      .insert(schema.organisations)
      .values({ legalName: `AI RLS Org ${suffix}`, displayName: `AI RLS Org ${suffix}`, kind: "other", status: "active" })
      .returning();
    const [provider] = await db
      .insert(schema.providers)
      .values({ organisationId: organisation.id, displayName: `AI RLS Provider ${suffix}`, status: "active" })
      .returning();

    await db
      .insert(schema.staffProfiles)
      .values({ id: staffOnlyId, email: `ai-staff-only-${suffix}@example.test`, displayName: "Staff Only", status: "active" });
    await db.insert(schema.staffRoleAssignments).values({ staffProfileId: staffOnlyId, role: "reviewer" });

    const [opportunity] = await db
      .insert(schema.opportunities)
      .values({
        slug: `ai-rls-test-${suffix}`,
        title: "AI RLS Test Opportunity",
        summary: "An opportunity for AI RLS testing.",
        opportunityTypeId: opportunityType.id,
        providerId: provider.id,
        status: "draft",
      })
      .returning();
    opportunityId = opportunity.id;

    const [officialSource] = await db
      .insert(schema.officialSources)
      .values({
        url: `https://example.test/ai-rls/${suffix}`,
        kind: "opportunity-page",
        label: "Test source",
        sourceOrganisationName: organisation.displayName,
        publisherOrganisationId: organisation.id,
        status: "confirmed-official",
        lastCheckedAt: new Date(),
      })
      .returning();
    await db.insert(schema.opportunityOfficialSources).values({ opportunityId, officialSourceId: officialSource.id });

    const [version] = await db
      .insert(schema.opportunityVersions)
      .values({ opportunityId, versionNumber: 1, snapshot: {}, authorStaffProfileId: staffOnlyId })
      .returning();
    await db
      .update(schema.opportunities)
      .set({ status: "published", publishedAt: new Date(), currentApprovedVersionId: version.id })
      .where(eq(schema.opportunities.id, opportunityId));

    await db
      .insert(schema.studentProfiles)
      .values([
        { id: studentA, email: `ai-student-a-${suffix}@example.test` },
        { id: studentB, email: `ai-student-b-${suffix}@example.test` },
      ]);

    const [approvedDocument] = await db
      .insert(schema.aiSourceDocuments)
      .values({ opportunityId, title: "Approved excerpt", sourceText: "Full tuition and stipend.", status: "approved" })
      .returning();
    approvedDocumentId = approvedDocument.id;
    const [approvedChunk] = await db
      .insert(schema.aiSourceChunks)
      .values({ documentId: approvedDocumentId, opportunityId, chunkIndex: 0, chunkText: "Full tuition and stipend.", status: "approved" })
      .returning();
    approvedChunkId = approvedChunk.id;

    const [draftDocument] = await db
      .insert(schema.aiSourceDocuments)
      .values({ opportunityId, title: "Draft excerpt", sourceText: "Unreviewed excerpt text.", status: "draft" })
      .returning();
    draftDocumentId = draftDocument.id;
    const [draftChunk] = await db
      .insert(schema.aiSourceChunks)
      .values({ documentId: draftDocumentId, opportunityId, chunkIndex: 0, chunkText: "Unreviewed excerpt text.", status: "draft" })
      .returning();
    draftChunkId = draftChunk.id;

    const [conversation] = await db
      .insert(schema.aiConversations)
      .values({ studentProfileId: studentA, scope: "general", title: "Test conversation" })
      .returning();
    conversationAId = conversation.id;
    const [message] = await db
      .insert(schema.aiMessages)
      .values({ conversationId: conversationAId, studentProfileId: studentA, role: "user", content: "Hello" })
      .returning();
    messageAId = message.id;
  });

  afterAll(async () => {
    await db.delete(schema.aiMessages).where(eq(schema.aiMessages.conversationId, conversationAId));
    await db.delete(schema.aiConversations).where(eq(schema.aiConversations.id, conversationAId));
    await db.delete(schema.aiSourceChunks).where(eq(schema.aiSourceChunks.opportunityId, opportunityId));
    await db.delete(schema.aiSourceDocuments).where(eq(schema.aiSourceDocuments.opportunityId, opportunityId));
    await db.delete(schema.opportunities).where(eq(schema.opportunities.id, opportunityId));
    await db.delete(schema.staffRoleAssignments).where(eq(schema.staffRoleAssignments.staffProfileId, staffOnlyId));
    await db.delete(schema.staffProfiles).where(eq(schema.staffProfiles.id, staffOnlyId));
    await db.delete(schema.studentProfiles).where(eq(schema.studentProfiles.id, studentA));
    await db.delete(schema.studentProfiles).where(eq(schema.studentProfiles.id, studentB));
    await client.end();
  });

  describe("ai_source_documents / ai_source_chunks (public, gated on approved + published)", () => {
    it("anon can read an approved chunk linked to a published opportunity", async () => {
      const rows = await asRole("anon", null, (tx) => tx.select().from(schema.aiSourceChunks).where(eq(schema.aiSourceChunks.id, approvedChunkId)));
      expect(rows).toHaveLength(1);
    });

    it("anon cannot read a draft chunk, even on the same published opportunity", async () => {
      const rows = await asRole("anon", null, (tx) => tx.select().from(schema.aiSourceChunks).where(eq(schema.aiSourceChunks.id, draftChunkId)));
      expect(rows).toHaveLength(0);
    });

    it("anon cannot read a draft source document", async () => {
      const rows = await asRole("anon", null, (tx) => tx.select().from(schema.aiSourceDocuments).where(eq(schema.aiSourceDocuments.id, draftDocumentId)));
      expect(rows).toHaveLength(0);
    });

    it("anon can read an approved source document", async () => {
      const rows = await asRole("anon", null, (tx) => tx.select().from(schema.aiSourceDocuments).where(eq(schema.aiSourceDocuments.id, approvedDocumentId)));
      expect(rows).toHaveLength(1);
    });

    it("staff can read draft documents/chunks that anon cannot", async () => {
      const documents = await asRole("authenticated", staffOnlyId, (tx) => tx.select().from(schema.aiSourceDocuments).where(eq(schema.aiSourceDocuments.id, draftDocumentId)));
      expect(documents).toHaveLength(1);
      const chunks = await asRole("authenticated", staffOnlyId, (tx) => tx.select().from(schema.aiSourceChunks).where(eq(schema.aiSourceChunks.id, draftChunkId)));
      expect(chunks).toHaveLength(1);
    });

    it("anon cannot insert an AI source document (no anon write policy)", async () => {
      await expectRejectionMatching(
        asRole("anon", null, (tx) =>
          tx.insert(schema.aiSourceDocuments).values({ title: "Malicious", sourceText: "Injected", status: "approved" }),
        ),
        /permission denied|row-level security/i,
      );
    });
  });

  describe("ai_conversations / ai_messages / ai_answer_citations / ai_retrieval_events (owner-only)", () => {
    it("a student can read their own conversation and messages", async () => {
      const conversations = await asRole("authenticated", studentA, (tx) => tx.select().from(schema.aiConversations).where(eq(schema.aiConversations.id, conversationAId)));
      expect(conversations).toHaveLength(1);
      const messages = await asRole("authenticated", studentA, (tx) => tx.select().from(schema.aiMessages).where(eq(schema.aiMessages.id, messageAId)));
      expect(messages).toHaveLength(1);
    });

    it("another student cannot read that conversation or its messages", async () => {
      const conversations = await asRole("authenticated", studentB, (tx) => tx.select().from(schema.aiConversations).where(eq(schema.aiConversations.id, conversationAId)));
      expect(conversations).toHaveLength(0);
      const messages = await asRole("authenticated", studentB, (tx) => tx.select().from(schema.aiMessages).where(eq(schema.aiMessages.id, messageAId)));
      expect(messages).toHaveLength(0);
    });

    it("staff cannot read a student's private conversation (no staff-select policy on this table)", async () => {
      const rows = await asRole("authenticated", staffOnlyId, (tx) => tx.select().from(schema.aiConversations).where(eq(schema.aiConversations.id, conversationAId)));
      expect(rows).toHaveLength(0);
    });

    it("anon cannot read any conversation (denied at the grant level, not just filtered by RLS)", async () => {
      await expectRejectionMatching(
        asRole("anon", null, (tx) => tx.select().from(schema.aiConversations)),
        /permission denied/i,
      );
    });

    it("a student cannot insert a message onto another student's conversation", async () => {
      await expectRejectionMatching(
        asRole("authenticated", studentB, (tx) =>
          tx.insert(schema.aiMessages).values({ conversationId: conversationAId, studentProfileId: studentB, role: "user", content: "Snooping" }),
        ),
        /row-level security/i,
      );
    });

    it("a student can create and read their own citation and retrieval event; another student cannot", async () => {
      const [citation] = await db
        .insert(schema.aiAnswerCitations)
        .values({ messageId: messageAId, studentProfileId: studentA, citationType: "structured-data", label: "Test citation" })
        .returning();
      const [retrievalEvent] = await db
        .insert(schema.aiRetrievalEvents)
        .values({ messageId: messageAId, studentProfileId: studentA, chunkCount: 1 })
        .returning();

      const ownCitations = await asRole("authenticated", studentA, (tx) => tx.select().from(schema.aiAnswerCitations).where(eq(schema.aiAnswerCitations.id, citation.id)));
      expect(ownCitations).toHaveLength(1);
      const otherCitations = await asRole("authenticated", studentB, (tx) => tx.select().from(schema.aiAnswerCitations).where(eq(schema.aiAnswerCitations.id, citation.id)));
      expect(otherCitations).toHaveLength(0);

      const ownEvents = await asRole("authenticated", studentA, (tx) => tx.select().from(schema.aiRetrievalEvents).where(eq(schema.aiRetrievalEvents.id, retrievalEvent.id)));
      expect(ownEvents).toHaveLength(1);
      const otherEvents = await asRole("authenticated", studentB, (tx) => tx.select().from(schema.aiRetrievalEvents).where(eq(schema.aiRetrievalEvents.id, retrievalEvent.id)));
      expect(otherEvents).toHaveLength(0);

      await db.delete(schema.aiAnswerCitations).where(eq(schema.aiAnswerCitations.id, citation.id));
      await db.delete(schema.aiRetrievalEvents).where(eq(schema.aiRetrievalEvents.id, retrievalEvent.id));
    });
  });

  describe("ai_feedback (dual owner + staff access)", () => {
    it("a student can read their own feedback; another student cannot", async () => {
      const [feedback] = await db
        .insert(schema.aiFeedback)
        .values({ messageId: messageAId, studentProfileId: studentA, rating: "helpful" })
        .returning();

      const own = await asRole("authenticated", studentA, (tx) => tx.select().from(schema.aiFeedback).where(eq(schema.aiFeedback.id, feedback.id)));
      expect(own).toHaveLength(1);
      const other = await asRole("authenticated", studentB, (tx) => tx.select().from(schema.aiFeedback).where(eq(schema.aiFeedback.id, feedback.id)));
      expect(other).toHaveLength(0);

      await db.delete(schema.aiFeedback).where(eq(schema.aiFeedback.id, feedback.id));
    });

    it("staff CAN read feedback (deliberate departure from the private-conversation precedent)", async () => {
      const [feedback] = await db
        .insert(schema.aiFeedback)
        .values({ messageId: messageAId, studentProfileId: studentA, rating: "incorrect", comment: "Wrong deadline" })
        .returning();

      const staffView = await asRole("authenticated", staffOnlyId, (tx) => tx.select().from(schema.aiFeedback).where(eq(schema.aiFeedback.id, feedback.id)));
      expect(staffView).toHaveLength(1);

      await db.delete(schema.aiFeedback).where(eq(schema.aiFeedback.id, feedback.id));
    });
  });

  describe("ai_usage_limits (read-only owner policy)", () => {
    it("a student can read their own usage row", async () => {
      const [usage] = await db
        .insert(schema.aiUsageLimits)
        .values({ studentProfileId: studentA, usageDate: "2026-01-01", requestCount: 3 })
        .returning();

      const rows = await asRole("authenticated", studentA, (tx) => tx.select().from(schema.aiUsageLimits).where(eq(schema.aiUsageLimits.id, usage.id)));
      expect(rows).toHaveLength(1);
      expect(rows[0].requestCount).toBe(3);

      await db.delete(schema.aiUsageLimits).where(eq(schema.aiUsageLimits.id, usage.id));
    });

    it("another student cannot read that usage row", async () => {
      const [usage] = await db
        .insert(schema.aiUsageLimits)
        .values({ studentProfileId: studentA, usageDate: "2026-01-02", requestCount: 1 })
        .returning();

      const rows = await asRole("authenticated", studentB, (tx) => tx.select().from(schema.aiUsageLimits).where(eq(schema.aiUsageLimits.id, usage.id)));
      expect(rows).toHaveLength(0);

      await db.delete(schema.aiUsageLimits).where(eq(schema.aiUsageLimits.id, usage.id));
    });

    it("a student cannot write to their own usage row directly (no insert/update policy — only service_role may write)", async () => {
      await expectRejectionMatching(
        asRole("authenticated", studentA, (tx) =>
          tx.insert(schema.aiUsageLimits).values({ studentProfileId: studentA, usageDate: "2026-01-03", requestCount: 999 }),
        ),
        /permission denied|row-level security/i,
      );
    });
  });

  describe("staff/internal-only tables (no public, no owner access)", () => {
    it("anon cannot read ai_prompt_templates, ai_evaluation_cases, ai_evaluation_runs, ai_provider_health, or ai_safety_events", async () => {
      await expectRejectionMatching(asRole("anon", null, (tx) => tx.select().from(schema.aiPromptTemplates)), /permission denied/i);
      await expectRejectionMatching(asRole("anon", null, (tx) => tx.select().from(schema.aiEvaluationCases)), /permission denied/i);
      await expectRejectionMatching(asRole("anon", null, (tx) => tx.select().from(schema.aiEvaluationRuns)), /permission denied/i);
      await expectRejectionMatching(asRole("anon", null, (tx) => tx.select().from(schema.aiProviderHealth)), /permission denied/i);
      await expectRejectionMatching(asRole("anon", null, (tx) => tx.select().from(schema.aiSafetyEvents)), /permission denied/i);
    });

    it("a signed-in student (no staff role) cannot read ai_safety_events", async () => {
      const rows = await asRole("authenticated", studentA, (tx) => tx.select().from(schema.aiSafetyEvents));
      expect(rows).toHaveLength(0);
    });

    it("staff can read ai_safety_events (RLS layer allows any staff role; the app layer further restricts to Administrator)", async () => {
      const [event] = await db.insert(schema.aiSafetyEvents).values({ kind: "prompt-injection", redactedSummary: "test" }).returning();
      const rows = await asRole("authenticated", staffOnlyId, (tx) => tx.select().from(schema.aiSafetyEvents).where(eq(schema.aiSafetyEvents.id, event.id)));
      expect(rows).toHaveLength(1);
      await db.delete(schema.aiSafetyEvents).where(eq(schema.aiSafetyEvents.id, event.id));
    });
  });
});
