import Link from "next/link";
import { Container } from "./Container";

export function Footer() {
  return (
    <footer className="border-t border-border bg-surface">
      <Container className="flex flex-col gap-4 py-8 text-sm text-foreground-muted sm:flex-row sm:items-center sm:justify-between">
        <p>
          &copy; {new Date().getFullYear()} ScholarTrack. Guest data stays in your browser — verify every
          opportunity with its official source before you rely on it.
        </p>
        <nav aria-label="Footer">
          <ul className="flex flex-wrap gap-x-5 gap-y-2">
            <li>
              <Link className="hover:text-foreground hover:underline" href="/privacy">
                Privacy
              </Link>
            </li>
            <li>
              <Link className="hover:text-foreground hover:underline" href="/settings">
                Settings
              </Link>
            </li>
            <li>
              <Link className="hover:text-foreground hover:underline" href="/opportunities">
                Browse opportunities
              </Link>
            </li>
          </ul>
        </nav>
      </Container>
    </footer>
  );
}
