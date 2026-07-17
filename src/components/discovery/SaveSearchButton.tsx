"use client";

import { BookmarkPlus } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Field";
import type { CatalogueFilters, CatalogueSortKey } from "@/lib/catalogue/search";
import { createGuestSavedSearch } from "@/lib/storage/saved-searches";
import { createMySavedSearch } from "@/lib/db/actions/student/saved-searches";

interface SaveSearchButtonProps {
  studentProfileId: string | null;
  filters: CatalogueFilters;
  sortKey: CatalogueSortKey;
  resultIds: string[];
  onSaved?: () => void;
}

export function SaveSearchButton({ studentProfileId, filters, sortKey, resultIds, onSaved }: SaveSearchButtonProps) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    const trimmed = name.trim();
    if (!trimmed) return;
    setSaving(true);

    const payload = {
      name: trimmed,
      queryText: filters.query,
      filters: filters as unknown as Record<string, unknown>,
      sortMode: sortKey,
      resultCountSnapshot: resultIds.length,
      resultSnapshot: resultIds,
    };

    if (studentProfileId) {
      await createMySavedSearch(payload);
    } else {
      await createGuestSavedSearch(payload);
    }

    setSaving(false);
    setOpen(false);
    setName("");
    onSaved?.();
  }

  if (!open) {
    return (
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <BookmarkPlus className="h-4 w-4" aria-hidden="true" />
        Save this search
      </Button>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <Input
        aria-label="Saved search name"
        placeholder="Name this search"
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="max-w-xs"
        autoFocus
      />
      <Button size="sm" disabled={saving || !name.trim()} onClick={() => void handleSave()}>
        {saving ? "Saving…" : "Save"}
      </Button>
      <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>
        Cancel
      </Button>
    </div>
  );
}
