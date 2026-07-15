"use client";

import { useEffect } from "react";

/**
 * Stamps `data-hydrated="true"` on <html> once React has mounted client-side.
 * Used by the Playwright e2e fixture to wait past hydration before it starts
 * interacting with forms/controlled inputs, avoiding a race where a fast
 * pre-hydration `fill()` gets clobbered by React's first render.
 */
export function HydrationMarker() {
  useEffect(() => {
    document.documentElement.setAttribute("data-hydrated", "true");
  }, []);

  return null;
}
