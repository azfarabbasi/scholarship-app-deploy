const FORMULA_PREFIX_PATTERN = /^[=+\-@\t\r]/;

/** Prefixes a leading `= + - @` (or tab/CR) with a `'` so Excel/Sheets never evaluates it as a formula. */
export function escapeCsvFormulaInjection(value: string): string {
  return FORMULA_PREFIX_PATTERN.test(value) ? `'${value}` : value;
}

function escapeCell(value: string): string {
  const safe = escapeCsvFormulaInjection(value);
  if (/[",\n\r]/.test(safe)) {
    return `"${safe.replace(/"/g, '""')}"`;
  }
  return safe;
}

export function buildCsv(headers: readonly string[], rows: readonly (readonly (string | number | null)[])[]): string {
  const lines = [headers.map((h) => escapeCell(h)).join(",")];
  for (const row of rows) {
    lines.push(row.map((cell) => escapeCell(cell === null ? "" : String(cell))).join(","));
  }
  return lines.join("\r\n") + "\r\n";
}
