/**
 * A small, dependency-free RFC 4180-ish CSV parser. Written in-house
 * (instead of adding a CSV library) so we control exactly how malformed
 * input, oversized files, and unexpected columns are rejected — see
 * `security.ts` for the formula-injection and column-allowlisting side of
 * that. Handles quoted fields, escaped `""` quotes, and both CRLF and LF line
 * endings.
 */

export const CSV_MAX_FILE_SIZE_BYTES = 2 * 1024 * 1024; // 2 MB
export const CSV_MAX_ROWS = 500;

export class CsvParseError extends Error {}

export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];

    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
      continue;
    }
    if (char === ",") {
      row.push(field);
      field = "";
      continue;
    }
    if (char === "\r") {
      continue;
    }
    if (char === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
      continue;
    }
    field += char;
  }

  if (inQuotes) {
    throw new CsvParseError("Unterminated quoted field.");
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows.filter((r) => !(r.length === 1 && r[0] === ""));
}

export interface ParsedCsvTable {
  headers: string[];
  rows: Record<string, string>[];
}

/**
 * Parses into header-keyed records, but ONLY for headers present in
 * `allowedColumns` — any other column is silently dropped rather than ever
 * being used as an object key, which is what actually prevents both
 * "unexpected columns" and prototype-pollution-style key tricks
 * (`__proto__`, `constructor`, etc. simply never match an allowed column).
 */
export function parseCsvTable(text: string, allowedColumns: readonly string[]): ParsedCsvTable {
  if (Buffer.byteLength(text, "utf8") > CSV_MAX_FILE_SIZE_BYTES) {
    throw new CsvParseError(`File exceeds the maximum size of ${CSV_MAX_FILE_SIZE_BYTES} bytes.`);
  }

  const allRows = parseCsv(text);
  if (allRows.length === 0) {
    throw new CsvParseError("The file is empty.");
  }

  const [headerRow, ...dataRows] = allRows;
  const allowedSet = new Set(allowedColumns);
  const headers = headerRow.map((h) => h.trim());

  if (dataRows.length > CSV_MAX_ROWS) {
    throw new CsvParseError(`File has ${dataRows.length} rows, exceeding the maximum of ${CSV_MAX_ROWS}.`);
  }

  const rows = dataRows.map((values) => {
    const record: Record<string, string> = {};
    headers.forEach((header, index) => {
      if (allowedSet.has(header)) {
        record[header] = (values[index] ?? "").trim();
      }
    });
    return record;
  });

  return { headers: headers.filter((h) => allowedSet.has(h)), rows };
}
