"use client";

import { useCallback, useSyncExternalStore } from "react";

const STORAGE_KEY = "scholartrack:comparison-selection";
const MAX_ITEMS = 4;

/**
 * Comparison state lives in localStorage only — deliberately never synced to
 * an account (see `docs/checkpoint-4/checkpoint-4-architecture.md`): it's
 * transient browsing state, not a durable record worth a database table and
 * RLS policy. Works identically for guests and signed-in users.
 */
const target = new EventTarget();

// `useSyncExternalStore` requires `getSnapshot` to return a referentially
// stable value when nothing has changed, or it re-renders forever. Cache
// the last-parsed array against the last-seen raw string so unrelated
// re-renders (or reading the same value twice) never produce a new array.
let cachedRaw: string | null = null;
let cachedIds: string[] = [];

function readIds(): string[] {
  if (typeof window === "undefined") return cachedIds;
  let raw: string | null;
  try {
    raw = window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return cachedIds;
  }
  if (raw === cachedRaw) return cachedIds;

  cachedRaw = raw;
  try {
    const parsed = raw ? JSON.parse(raw) : [];
    cachedIds = Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === "string") : [];
  } catch {
    cachedIds = [];
  }
  return cachedIds;
}

function writeIds(ids: string[]): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
  target.dispatchEvent(new Event("change"));
}

function subscribe(callback: () => void): () => void {
  target.addEventListener("change", callback);
  window.addEventListener("storage", callback);
  return () => {
    target.removeEventListener("change", callback);
    window.removeEventListener("storage", callback);
  };
}

// A single stable reference, never a fresh `[]` literal per call — React's
// `useSyncExternalStore` treats a changed reference as a changed snapshot and
// would otherwise warn ("should be cached to avoid an infinite loop") or
// re-render unnecessarily on every check during hydration.
const EMPTY_IDS: string[] = [];

function getServerSnapshot(): string[] {
  return EMPTY_IDS;
}

export function useComparisonSelection() {
  const ids = useSyncExternalStore(subscribe, readIds, getServerSnapshot);

  const toggle = useCallback((id: string) => {
    const current = readIds();
    if (current.includes(id)) {
      writeIds(current.filter((v) => v !== id));
      return;
    }
    if (current.length >= MAX_ITEMS) return;
    writeIds([...current, id]);
  }, []);

  const clear = useCallback(() => writeIds([]), []);
  const remove = useCallback((id: string) => writeIds(readIds().filter((v) => v !== id)), []);

  return { ids, toggle, clear, remove, isFull: ids.length >= MAX_ITEMS, maxItems: MAX_ITEMS };
}
