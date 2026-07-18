import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import type { ReactNode } from "react";
import { LiveAnnouncerProvider } from "@/components/common/LiveAnnouncer";
import { AnalyticsInit } from "@/components/layout/AnalyticsInit";
import { Footer } from "@/components/layout/Footer";
import { Header } from "@/components/layout/Header";
import { HydrationMarker } from "@/components/layout/HydrationMarker";
import { OfflineBanner } from "@/components/layout/OfflineBanner";
import { ServiceWorkerRegistration } from "@/components/layout/ServiceWorkerRegistration";
import { SkipLink } from "@/components/layout/SkipLink";
import { ThemeProvider } from "@/components/layout/ThemeProvider";
import { ScholarlyWidget } from "@/components/assistant/ScholarlyWidget";
import { isScholarlyWidgetPath } from "@/lib/assistant/scholarly-widget-pages";
import { isAiAvailableAction } from "@/lib/db/actions/student/ai-assistant";
import { getAppBaseUrl } from "@/lib/env";
import "./globals.css";

const appUrl = getAppBaseUrl();

export const metadata: Metadata = {
  metadataBase: new URL(appUrl),
  title: {
    default: "ScholarTrack — Verified scholarship & internship tracking",
    template: "%s · ScholarTrack",
  },
  description:
    "ScholarTrack helps students discover, track, and plan verified scholarship and internship opportunities across Europe. Guest data stays on your device.",
  applicationName: "ScholarTrack",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "ScholarTrack",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f7f8fb" },
    { media: "(prefers-color-scheme: dark)", color: "#0b1120" },
  ],
};

export default async function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  // Set per-request by src/lib/supabase/middleware.ts and consumed here so
  // next-themes' blocking pre-hydration script carries the same nonce as the
  // Content-Security-Policy header — see src/lib/security/csp.ts.
  const requestHeaders = await headers();
  const nonce = requestHeaders.get("x-nonce") ?? undefined;

  // Only spend the "is AI available" DB round-trip when the current path is
  // even eligible for the floating Scholarly widget — staff/admin, auth,
  // legal/static content, and account sub-pages never render it, so most
  // requests skip this entirely. See src/lib/assistant/scholarly-widget-pages.ts.
  const pathname = requestHeaders.get("x-pathname") ?? "";
  const scholarlyWidgetEligible = isScholarlyWidgetPath(pathname);
  const aiAvailable = scholarlyWidgetEligible && (await isAiAvailableAction());

  return (
    <html lang="en" suppressHydrationWarning>
      <body className="flex min-h-screen flex-col bg-background text-foreground antialiased">
        <ThemeProvider nonce={nonce}>
          <LiveAnnouncerProvider>
            <SkipLink />
            <OfflineBanner />
            <Header />
            <main id="main-content" tabIndex={-1} className="flex-1 focus:outline-none">
              {children}
            </main>
            <Footer />
            <ScholarlyWidget aiAvailable={aiAvailable} />
            <ServiceWorkerRegistration />
            <AnalyticsInit />
            <HydrationMarker />
          </LiveAnnouncerProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
