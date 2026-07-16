"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Input, Label } from "@/components/ui/Field";
import { createTaxonomyValue } from "@/lib/db/actions/reference-data";

type TaxonomyKind = "region" | "study-level" | "field-of-study" | "funding-type" | "document-template";

export function CreateTaxonomyValueForm({ kind, label }: { kind: TaxonomyKind; label: string }) {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [valueLabel, setValueLabel] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const result = await createTaxonomyValue(kind, { code, label: valueLabel });
    setBusy(false);
    if (!result.ok) {
      setError(result.error ?? "Could not create this value.");
      return;
    }
    setCode("");
    setValueLabel("");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-2 rounded-md border border-border p-3">
      {error ? (
        <div className="w-full">
          <Alert tone="danger">{error}</Alert>
        </div>
      ) : null}
      <div>
        <Label htmlFor={`${kind}-code`}>Code</Label>
        <Input id={`${kind}-code`} required value={code} onChange={(e) => setCode(e.target.value)} placeholder="unique-code" />
      </div>
      <div>
        <Label htmlFor={`${kind}-label`}>Label</Label>
        <Input id={`${kind}-label`} required value={valueLabel} onChange={(e) => setValueLabel(e.target.value)} />
      </div>
      <Button type="submit" size="sm" disabled={busy}>
        Add {label}
      </Button>
    </form>
  );
}
