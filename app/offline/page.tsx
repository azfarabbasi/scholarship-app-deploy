import { WifiOff } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Container } from "@/components/layout/Container";
import { Button } from "@/components/ui/Button";

export const metadata: Metadata = {
  title: "You're offline",
  description: "ScholarTrack's offline fallback page.",
  robots: { index: false },
};

export default function OfflinePage() {
  return (
    <Container className="flex flex-col items-center gap-4 py-20 text-center">
      <WifiOff className="h-10 w-10 text-foreground-subtle" aria-hidden="true" />
      <h1 className="text-2xl font-semibold text-foreground">You&rsquo;re offline</h1>
      <p className="max-w-md text-sm text-foreground-muted">
        This exact page isn&rsquo;t available without a connection. If you&rsquo;ve visited ScholarTrack before, the
        catalogue, your workspace, calendar, and settings should still work from the navigation menu — they&rsquo;re
        saved locally on this device.
      </p>
      <div className="flex flex-wrap justify-center gap-2">
        <Button asChild>
          <Link href="/opportunities">Try the catalogue</Link>
        </Button>
        <Button variant="outline" asChild>
          <Link href="/workspace">Go to my workspace</Link>
        </Button>
      </div>
    </Container>
  );
}
