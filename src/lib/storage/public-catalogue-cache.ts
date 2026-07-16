import type { CatalogueOpportunity } from "@/lib/catalogue/types";
import { getDb } from "./db";
import type { PublicCatalogueCacheRecord } from "./types";

export async function getCachedPublicCatalogue(): Promise<PublicCatalogueCacheRecord | undefined> {
  const db = await getDb();
  return db.get("publicCatalogueCache", "snapshot");
}

export async function setCachedPublicCatalogue(items: CatalogueOpportunity[], syncedAt: string): Promise<void> {
  const db = await getDb();
  await db.put("publicCatalogueCache", { key: "snapshot", items, syncedAt });
}
