import type { ReactNode } from "react";
import { Alert } from "@/components/ui/Alert";

export function ErrorState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <Alert tone="danger" title={title}>
      {children ?? "Something went wrong. Try reloading the page."}
    </Alert>
  );
}
