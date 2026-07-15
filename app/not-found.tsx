import { Compass } from "lucide-react";
import Link from "next/link";
import { Container } from "@/components/layout/Container";
import { Button } from "@/components/ui/Button";

export default function NotFound() {
  return (
    <Container className="flex flex-col items-center gap-4 py-20 text-center">
      <Compass className="h-10 w-10 text-foreground-subtle" aria-hidden="true" />
      <h1 className="text-2xl font-semibold text-foreground">Page not found</h1>
      <p className="max-w-md text-sm text-foreground-muted">
        The page you&rsquo;re looking for doesn&rsquo;t exist. It may have been moved, or the opportunity may not be
        saved on this device.
      </p>
      <Button asChild>
        <Link href="/opportunities">Browse opportunities</Link>
      </Button>
    </Container>
  );
}
