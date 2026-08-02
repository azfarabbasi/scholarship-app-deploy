"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { runOpportunityCsvImport, type CsvImportResult } from "@/lib/db/actions/csv-import";

export function CsvImportForm() {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<CsvImportResult | null>(null);

  async function run(dryRun: boolean) {
    if (!file) return;
    setBusy(true);
    const text = await file.text();
    const outcome = await runOpportunityCsvImport(text, dryRun);
    setResult(outcome);
    setBusy(false);
    if (!dryRun) router.refresh();
  }

  return (
    <div className="flex flex-col gap-3">
      <input
        type="file"
        accept=".csv,text/csv"
        onChange={(e) => {
          setFile(e.target.files?.[0] ?? null);
          setResult(null);
        }}
        className="text-sm"
      />
      <div className="flex gap-2">
        <Button size="sm" variant="outline" disabled={!file || busy} onClick={() => run(true)}>
          Dry run (preview only)
        </Button>
        <Button size="sm" disabled={!file || busy || !result || result.rows.every((r) => r.outcome !== "would-create")} onClick={() => run(false)}>
          Commit import
        </Button>
      </div>

      {result ? (
        <div className="rounded-md border border-border p-3 text-sm">
          {!result.ok ? (
            <Alert tone="danger">{result.error}</Alert>
          ) : (
            <>
              <p className="font-medium text-foreground">
                {result.totalRows} rows — {result.accepted} accepted, {result.rejected} rejected,{" "}
                {result.duplicateWarnings}{" "}
                duplicate warnings.
              </p>
              <ul className="mt-2 max-h-64 overflow-y-auto">
                {result.rows.map((row) => (
                  <li key={row.rowNumber} className="border-t border-border py-1 first:border-t-0">
                    Row {row.rowNumber}: {row.outcome}
                    {row.title ? ` — ${row.title}` : ""}
                    {row.errors ? (
                      <ul className="ml-4 list-disc text-danger">
                        {row.errors.map((err, index) => (
                          <li key={index}>{err}</li>
                        ))}
                      </ul>
                    ) : null}
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      ) : null}
    </div>
  );
}
