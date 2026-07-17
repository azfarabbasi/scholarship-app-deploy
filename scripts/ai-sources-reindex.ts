/**
 * `npm run ai:sources:reindex` — operator CLI equivalent of the staff "rebuild
 * all chunks" action: re-derives every `ai_source_chunk` row from its parent
 * `ai_source_document`'s current text and status. Run this after a bulk
 * source-text edit made directly against the database, or as a periodic
 * maintenance job. Trusted, unauthenticated by design (like
 * `db-seed-taxonomies.ts`) — it is an operator tool, not a public or
 * student-facing path.
 */
import "dotenv/config";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "../src/lib/db/schema";
import { buildChunkDrafts } from "../src/lib/ai/rag/chunking";

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error("DATABASE_URL must be set.");
    process.exit(1);
  }

  const client = postgres(connectionString, { max: 1 });
  const db = drizzle(client, { schema });

  const documents = await db.select().from(schema.aiSourceDocuments);
  console.log(`Rebuilding chunks for ${documents.length} AI source document(s)...`);

  let totalChunks = 0;
  for (const document of documents) {
    const drafts = buildChunkDrafts(document.sourceText);
    await db.transaction(async (tx) => {
      await tx.delete(schema.aiSourceChunks).where(eq(schema.aiSourceChunks.documentId, document.id));
      if (drafts.length > 0) {
        await tx.insert(schema.aiSourceChunks).values(
          drafts.map((draft) => ({
            documentId: document.id,
            opportunityId: document.opportunityId,
            officialSourceId: document.officialSourceId,
            chunkIndex: draft.chunkIndex,
            chunkText: draft.chunkText,
            tokenCountEstimate: draft.tokenCountEstimate,
            status: document.status,
          })),
        );
      }
    });
    totalChunks += drafts.length;
    console.log(`  - "${document.title}": ${drafts.length} chunk(s)`);
  }

  console.log(`\nRebuilt ${totalChunks} chunk(s) across ${documents.length} document(s).`);
  await client.end();
}

main().catch((error: unknown) => {
  console.error("ai:sources:reindex failed:", error);
  process.exit(1);
});
