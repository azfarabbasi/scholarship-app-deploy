/**
 * Deterministic saved-search alert diffing — pure, no DB/network access.
 * Compares the ids present the last time a saved search was checked against
 * the ids present right now and produces honest, specific messages. Never
 * invents an alert when nothing has actually changed.
 */
export interface SavedSearchAlertResult {
  hasAlert: boolean;
  newOpportunityCount: number;
  removedOpportunityCount: number;
  messages: string[];
}

export function diffSavedSearchResults(previousIds: readonly string[], currentIds: readonly string[]): SavedSearchAlertResult {
  const previousSet = new Set(previousIds);
  const currentSet = new Set(currentIds);

  const added = currentIds.filter((id) => !previousSet.has(id));
  const removed = previousIds.filter((id) => !currentSet.has(id));

  const messages: string[] = [];
  if (added.length > 0) {
    messages.push(`${added.length} newly published opportunit${added.length === 1 ? "y matches" : "ies match"} this saved search.`);
  }
  if (removed.length > 0) {
    messages.push(`${removed.length} previously matching opportunit${removed.length === 1 ? "y is" : "ies are"} no longer in your results (archived, unpublished, or no longer matching).`);
  }

  return {
    hasAlert: added.length > 0 || removed.length > 0,
    newOpportunityCount: added.length,
    removedOpportunityCount: removed.length,
    messages,
  };
}
