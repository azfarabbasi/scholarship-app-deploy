import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { LiveAnnouncerProvider } from "@/components/common/LiveAnnouncer";
import { Footer } from "@/components/layout/Footer";
import { Header } from "@/components/layout/Header";
import { HydrationMarker } from "@/components/layout/HydrationMarker";
import { OfflineBanner } from "@/components/layout/OfflineBanner";
import { ServiceWorkerRegistration } from "@/components/layout/ServiceWorkerRegistration";
import { SkipLink } from "@/components/layout/SkipLink";
import { ThemeProvider } from "@/components/layout/ThemeProvider";
import "./globals.css";

const configuredAppUrl = process.env.NEXT_PUBLIC_APP_URL;
const appUrl = configuredAppUrl?.startsWith("http") ? configuredAppUrl : "http://localhost:3000";

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

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="flex min-h-screen flex-col bg-background text-foreground antialiased">
        <ThemeProvider>
          <LiveAnnouncerProvider>
            <SkipLink />
            <OfflineBanner />
            <Header />
            <main id="main-content" tabIndex={-1} className="flex-1 focus:outline-none">
              {children}
            </main>
            <Footer />
            <ServiceWorkerRegistration />
            <HydrationMarker />
          </LiveAnnouncerProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
