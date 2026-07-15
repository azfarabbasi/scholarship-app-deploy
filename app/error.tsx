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
    console.error("ScholarTrack route error:", error);
  }, [error]);

  return (
    <Container className="py-16">
      <ErrorState title="Something went wrong">
        This page hit an unexpected error. Your locally saved data is unaffected — try again below.
      </ErrorState>
      <div className="mt-4">
        <Button onClick={() => reset()}>Try again</Button>
      </div>
    </Container>
  );
}
