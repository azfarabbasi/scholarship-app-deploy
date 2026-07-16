"use server";

import { and, eq, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getStudentSession } from "@/lib/auth/student-session";
import { getDb, schema } from "@/lib/db/client";
import { customOpportunityInputSchema, type CustomOpportunityInput } from "@/lib/schemas/custom-opportunity";

export type CustomOpportunityRow = typeof schema.userCustomOpportunities.$inferSelect;

export interface CustomOpportunityActionResult {
  ok: boolean;
  error?: string;
  data?: CustomOpportunityRow;
}

function slugify(title: string): string {
  const base = title
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return base.length > 0 ? base : "custom-opportunity";
}

/** Custom opportunities are never labelled official or verified — no source/verification link ever exists for them. */
export async function getMyCustomOpportunities(): Promise<CustomOpportunityRow[]> {
  const session = await getStudentSession();
  if (!session) return [];
  const db = getDb();
  return db
    .select()
    .from(schema.userCustomOpportunities)
    .where(
      and(
        eq(schema.userCustomOpportunities.studentProfileId, session.studentProfileId),
        isNull(schema.userCustomOpportunities.archivedAt),
      ),
    );
}

async function uniqueSlug(studentProfileId: string, title: string, ignoreId?: string): Promise<string> {
  const db = getDb();
  const existing = await db
    .select({ id: schema.userCustomOpportunities.id, slug: schema.userCustomOpportunities.slug })
    .from(schema.userCustomOpportunities)
    .where(eq(schema.userCustomOpportunities.studentProfileId, studentProfileId));
  const taken = new Set(existing.filter((row) => row.id !== ignoreId).map((row) => row.slug));
  const base = slugify(title);
  if (!taken.has(base)) return base;
  let counter = 2;
  while (taken.has(`${base}-${counter}`)) counter += 1;
  return `${base}-${counter}`;
}

export async function createMyCustomOpportunity(input: CustomOpportunityInput): Promise<CustomOpportunityActionResult> {
  const session = await getStudentSession();
  if (!session) return { ok: false, error: "Not signed in." };

  const parsed = customOpportunityInputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid custom opportunity." };
  }

  const slug = await uniqueSlug(session.studentProfileId, parsed.data.title);
  const db = getDb();
  const [row] = await db
    .insert(schema.userCustomOpportunities)
    .values({ studentProfileId: session.studentProfileId, slug, ...parsed.data })
    .returning();

  revalidatePath("/workspace");
  return { ok: true, data: row };
}

async function requireOwned(studentProfileId: string, id: string) {
  const db = getDb();
  const [row] = await db
    .select()
    .from(schema.userCustomOpportunities)
    .where(and(eq(schema.userCustomOpportunities.id, id), eq(schema.userCustomOpportunities.studentProfileId, studentProfileId)))
    .limit(1);
  return row ?? null;
}

export async function updateMyCustomOpportunity(
  id: string,
  input: CustomOpportunityInput,
): Promise<CustomOpportunityActionResult> {
  const session = await getStudentSession();
  if (!session) return { ok: false, error: "Not signed in." };

  const existing = await requireOwned(session.studentProfileId, id);
  if (!existing) return { ok: false, error: "Custom opportunity not found." };

  const parsed = customOpportunityInputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid custom opportunity." };
  }

  const slug =
    parsed.data.title === existing.title ? existing.slug : await uniqueSlug(session.studentProfileId, parsed.data.title, id);

  const db = getDb();
  const [row] = await db
    .update(schema.userCustomOpportunities)
    .set({ slug, ...parsed.data, updatedAt: new Date() })
    .where(eq(schema.userCustomOpportunities.id, id))
    .returning();

  revalidatePath("/workspace");
  return { ok: true, data: row };
}

export async function archiveMyCustomOpportunity(id: string): Promise<{ ok: boolean; error?: string }> {
  const session = await getStudentSession();
  if (!session) return { ok: false, error: "Not signed in." };

  const existing = await requireOwned(session.studentProfileId, id);
  if (!existing) return { ok: false, error: "Custom opportunity not found." };

  const db = getDb();
  await db
    .update(schema.userCustomOpportunities)
    .set({ archivedAt: new Date(), updatedAt: new Date() })
    .where(eq(schema.userCustomOpportunities.id, id));

  revalidatePath("/workspace");
  return { ok: true };
}

export async function deleteMyCustomOpportunity(id: string): Promise<{ ok: boolean; error?: string }> {
  const session = await getStudentSession();
  if (!session) return { ok: false, error: "Not signed in." };

  const existing = await requireOwned(session.studentProfileId, id);
  if (!existing) return { ok: false, error: "Custom opportunity not found." };

  const db = getDb();
  await db.delete(schema.userCustomOpportunities).where(eq(schema.userCustomOpportunities.id, id));

  revalidatePath("/workspace");
  return { ok: true };
}
