"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";
import type { ReactNode } from "react";

/**
 * `nonce`, when provided, is applied to next-themes' blocking inline
 * pre-hydration script — the one inline script this app legitimately needs
 * — so it executes under the app's nonce-based Content-Security-Policy
 * without a blanket `script-src 'unsafe-inline'`. See
 * `src/lib/security/csp.ts` and `app/layout.tsx`.
 */
export function ThemeProvider({ children, nonce }: { children: ReactNode; nonce?: string }) {
  return (
    <NextThemesProvider attribute="data-theme" defaultTheme="system" enableSystem disableTransitionOnChange nonce={nonce}>
      {children}
    </NextThemesProvider>
  );
}
