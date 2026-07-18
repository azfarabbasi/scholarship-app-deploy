"use client";

import { useEffect } from "react";

/**
 * Catches an error thrown by the root layout itself (app/error.tsx only
 * catches errors from routes/pages rendered inside the layout, not the
 * layout's own render). Must render its own complete `<html>`/`<body>` —
 * the root layout that would normally provide them is exactly what failed.
 * Deliberately minimal: no theme provider, no design-system components,
 * nothing that could itself be the reason the root layout failed.
 */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("ScholarTrack: the root layout itself failed to render:", error);
  }, [error]);

  return (
    <html lang="en">
      <body style={{ fontFamily: "system-ui, sans-serif", padding: "2rem", maxWidth: "40rem", margin: "0 auto" }}>
        <h1 style={{ fontSize: "1.5rem", fontWeight: 600 }}>Something went wrong</h1>
        <p style={{ marginTop: "0.5rem", color: "#555" }}>
          ScholarTrack hit an unexpected error while loading the page shell. Your locally saved data is unaffected.
        </p>
        <button
          onClick={() => reset()}
          style={{ marginTop: "1rem", padding: "0.5rem 1rem", border: "1px solid #ccc", borderRadius: "0.375rem" }}
        >
          Try again
        </button>
      </body>
    </html>
  );
}
