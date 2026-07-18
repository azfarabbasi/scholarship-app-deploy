import Link from "next/link";
import { AdSlot } from "@/components/ads/AdSlot";
import { Container } from "./Container";

const FOOTER_LINKS: { href: string; label: string }[] = [
  { href: "/opportunities", label: "Browse opportunities" },
  { href: "/about", label: "About" },
  { href: "/methodology", label: "Methodology" },
  { href: "/faq", label: "FAQ" },
  { href: "/data-sources", label: "Data sources" },
  { href: "/verification-policy", label: "Verification policy" },
  { href: "/privacy", label: "Privacy" },
  { href: "/terms", label: "Terms" },
  { href: "/disclaimer", label: "Disclaimer" },
  { href: "/advertising-policy", label: "Advertising policy" },
  { href: "/accessibility", label: "Accessibility" },
  { href: "/security", label: "Security" },
  { href: "/status", label: "Status" },
  { href: "/contact", label: "Contact" },
  { href: "/settings", label: "Settings" },
];

export function Footer() {
  return (
    <footer className="border-t border-border bg-surface">
      <Container className="flex flex-col gap-4 py-8">
        <AdSlot placement="footer" />
        <div className="flex flex-col gap-4 text-sm text-foreground-muted sm:flex-row sm:items-start sm:justify-between">
          <p className="sm:max-w-xs">
            &copy; {new Date().getFullYear()} ScholarTrack. Guest data stays in your browser — verify every
            opportunity with its official source before you rely on it.
          </p>
          <nav aria-label="Footer">
            <ul className="flex flex-wrap gap-x-5 gap-y-2">
              {FOOTER_LINKS.map((link) => (
                <li key={link.href}>
                  <Link className="hover:text-foreground hover:underline" href={link.href}>
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>
      </Container>
    </footer>
  );
}
