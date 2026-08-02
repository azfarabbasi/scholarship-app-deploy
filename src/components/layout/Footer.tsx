import { GraduationCap } from "lucide-react";
import Link from "next/link";
import { AdSlot } from "@/components/ads/AdSlot";
import { Container } from "./Container";

/**
 * Same fifteen destinations as before, grouped into labelled columns — a single
 * flat wrap gave "Privacy" and "Browse opportunities" identical weight, so
 * there was nothing to scan by. Each column heading is a real <h2> that the
 * nested <nav> is labelled by, so the grouping is exposed to screen readers too.
 */
const FOOTER_GROUPS: { id: string; heading: string; links: { href: string; label: string }[] }[] = [
  {
    id: "explore",
    heading: "Explore",
    links: [
      { href: "/opportunities", label: "Browse opportunities" },
      { href: "/calendar", label: "Deadline calendar" },
      { href: "/workspace", label: "Your workspace" },
      { href: "/settings", label: "Settings" },
    ],
  },
  {
    id: "how-it-works",
    heading: "How it works",
    links: [
      { href: "/about", label: "About" },
      { href: "/methodology", label: "Methodology" },
      { href: "/data-sources", label: "Data sources" },
      { href: "/verification-policy", label: "Verification policy" },
      { href: "/faq", label: "FAQ" },
    ],
  },
  {
    id: "legal",
    heading: "Legal",
    links: [
      { href: "/privacy", label: "Privacy" },
      { href: "/terms", label: "Terms" },
      { href: "/disclaimer", label: "Disclaimer" },
      { href: "/advertising-policy", label: "Advertising policy" },
    ],
  },
  {
    id: "support",
    heading: "Support",
    links: [
      { href: "/contact", label: "Contact" },
      { href: "/accessibility", label: "Accessibility" },
      { href: "/security", label: "Security" },
      { href: "/status", label: "Status" },
    ],
  },
];

export function Footer() {
  return (
    <footer className="mt-auto border-t border-border bg-surface">
      <Container className="flex flex-col gap-8 py-10">
        <AdSlot placement="footer" />

        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-[1.5fr_repeat(4,1fr)]">
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2.5 text-base font-semibold tracking-tight text-foreground">
              <span
                aria-hidden="true"
                className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand text-brand-foreground"
              >
                <GraduationCap className="h-[1.15rem] w-[1.15rem]" />
              </span>
              ScholarTrack
            </div>
            <p className="max-w-xs text-sm leading-relaxed text-foreground-muted">
              Guest data stays in your browser — verify every opportunity with its official source before you rely
              on it.
            </p>
          </div>

          {FOOTER_GROUPS.map((group) => (
            <nav key={group.id} aria-labelledby={`footer-${group.id}`}>
              <h2 id={`footer-${group.id}`} className="text-sm font-semibold text-foreground">
                {group.heading}
              </h2>
              <ul className="mt-3 flex flex-col gap-2.5">
                {group.links.map((link) => (
                  <li key={link.href}>
                    <Link
                      className="rounded text-sm text-foreground-muted transition-colors hover:text-brand focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus-ring)]"
                      href={link.href}
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>

        <p className="border-t border-border pt-6 text-sm text-foreground-subtle">
          &copy; {new Date().getFullYear()}{" "}
          ScholarTrack. All opportunity data requires independent verification.
        </p>
      </Container>
    </footer>
  );
}
