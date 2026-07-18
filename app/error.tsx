"use client";

import { useEffect } from "react";
import { Container } from "@/components/layout/Container";
import { Button } from "@/components/ui/Button";
import { ErrorState } from "@/components/common/ErrorState";

export default function GlobalRouteError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // The full error is only ever logged to the browser console, never sent
    // anywhere — matching this app's no-required-external-error-reporter
    // design (see docs/checkpoint-6/checkpoint-6-architecture.md).
    console.error(`ScholarTrack route error${error.digest ? ` (ref ${error.digest})` : ""}:`, error);
  }, [error]);

  return (
    <Container className="py-16">
      <ErrorState title="Something went wrong">
        This page hit an unexpected error. Your locally saved data is unaffected — try again below.
        {error.digest ? (
          <>
            {" "}
            If this keeps happening, you can mention reference <code>{error.digest}</code> when contacting support.
          </>
        ) : null}
      </ErrorState>
      <div className="mt-4">
        <Button onClick={() => reset()}>Try again</Button>
      </div>
    </Container>
  );
}
