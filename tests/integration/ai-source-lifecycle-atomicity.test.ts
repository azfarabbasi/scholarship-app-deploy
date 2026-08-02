import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import * as schema from "../../src/lib/db/schema";
import { db, client, uniqueSuffix } from "./helpers";

/**
 * `setAiSourceDocumentStatus` derives the caller's identity from
 * `getStaffSession()`, never from client input — mocking it lets the test
 * drive the Server Action directly while every database side effect still
 * runs for real (see tests/integration/helpers.ts and the equivalent
 * pattern in tests/integration/account-import-security.test.ts).
 */
vi.mock("@/lib/auth/session", () => ({
  getStaffSession: vi.fn(),
}));

// `revalidatePath` requires a real Next.js request-scoped static-generation
// store that doesn't exist when a Server Action is called directly from a
// plain Vitest test — stub it as a no-op, matching how every other
// integration test that exercises a "use server" action needs no real
// Next.js runtime for its actual database behavior to be tested.
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

const { getStaffSession } = await import("@/lib/auth/session");
const { setAiSourceDocumentStatus } = await import("../../src/lib/db/actions/ai-staff");

const mockedGetStaffSession = vi.mocked(getStaffSession);

function sessionFor(staffProfileId: string, roles: string[]) {
  return {
    staffProfileId,
    email: `${staffProfileId}@example.test`,
    displayName: "Staff",
    roles: roles as never,
    isBootstrapAdmin: false,
  };
}

/**
 * Phase 3 item 6: the document's own `status` and every one of its chunks'
 * `status` must never fall out of sync — retrieval filters chunks by their
 * OWN status column, not the parent document's, so if these were still two
 * separate, non-transactional writes, a crash between them could leave
 * rejected/stale chunks retrievable (document flipped, chunks didn't) or
 * approved content unreachable (document flipped, chunks stuck on draft).
 * This test can't literally kill the process mid-write, but it does prove
 * the end state is always consistent — the two rows are written in one
 * `db.transaction(...)` now, so partial application isn't possible short of
 * the whole transaction rolling back.
 */
describe("setAiSourceDocumentStatus document/chunk atomicity (Phase 3 item 6)", () => {
  const suffix = uniqueSuffix();
  const managerId = "66666666-1111-4666-a666-666666666666";
  const approverId = "66666666-2222-4666-a666-666666666666";
  let documentId: string;

  beforeAll(async () => {
    await db.insert(schema.staffProfiles).values({ id: managerId, email: `ai-lifecycle-manager-${suffix}@example.test`, displayName: "Manager", status: "active" });
    await db.insert(schema.staffRoleAssignments).values({ staffProfileId: managerId, role: "reviewer" });
    await db.insert(schema.staffProfiles).values({ id: approverId, email: `ai-lifecycle-approver-${suffix}@example.test`, displayName: "Approver", status: "active" });
    await db.insert(schema.staffRoleAssignments).values({ staffProfileId: approverId, role: "senior_reviewer" });

    const [document] = await db
      .insert(schema.aiSourceDocuments)
      .values({
        title: "Lifecycle test document",
        sourceText: "Applicants must submit a transcript and two reference letters by the deadline.",
        status: "draft",
        createdByStaffProfileId: managerId,
      })
      .returning();
    documentId = document.id;

    await db.insert(schema.aiSourceChunks).values([
      { documentId, chunkIndex: 0, chunkText: "Applicants must submit a transcript.", status: "draft" },
      { documentId, chunkIndex: 1, chunkText: "Applicants must submit two reference letters.", status: "draft" },
    ]);
  });

  afterAll(async () => {
    await db.delete(schema.aiSourceChunks).where(eq(schema.aiSourceChunks.documentId, documentId));
    await db.delete(schema.aiSourceDocuments).where(eq(schema.aiSourceDocuments.id, documentId));
    await db.delete(schema.staffRoleAssignments).where(eq(schema.staffRoleAssignments.staffProfileId, approverId));
    await db.delete(schema.staffProfiles).where(eq(schema.staffProfiles.id, approverId));
    await db.delete(schema.staffRoleAssignments).where(eq(schema.staffRoleAssignments.staffProfileId, managerId));
    await db.delete(schema.staffProfiles).where(eq(schema.staffProfiles.id, managerId));
    await client.end();
  });

  it("approving a document flips every one of its chunks to approved in the same operation", async () => {
    mockedGetStaffSession.mockResolvedValue(sessionFor(approverId, ["senior_reviewer"]));

    const result = await setAiSourceDocumentStatus(documentId, "approved");
    expect(result.ok).toBe(true);

    const [document] = await db.select().from(schema.aiSourceDocuments).where(eq(schema.aiSourceDocuments.id, documentId));
    const chunks = await db.select().from(schema.aiSourceChunks).where(eq(schema.aiSourceChunks.documentId, documentId));

    expect(document.status).toBe("approved");
    expect(chunks.every((chunk) => chunk.status === "approved")).toBe(true);
  });

  it("rejecting a previously-approved document flips every chunk back to rejected — none remain retrievable as approved", async () => {
    mockedGetStaffSession.mockResolvedValue(sessionFor(approverId, ["senior_reviewer"]));

    const result = await setAiSourceDocumentStatus(documentId, "rejected");
    expect(result.ok).toBe(true);

    const [document] = await db.select().from(schema.aiSourceDocuments).where(eq(schema.aiSourceDocuments.id, documentId));
    const chunks = await db.select().from(schema.aiSourceChunks).where(eq(schema.aiSourceChunks.documentId, documentId));

    expect(document.status).toBe("rejected");
    expect(chunks.every((chunk) => chunk.status === "rejected")).toBe(true);
    expect(chunks.some((chunk) => chunk.status === "approved")).toBe(false);
  });
});
