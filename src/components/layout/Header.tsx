"use client";

import { GraduationCap, LogIn, Menu, User, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { cn } from "@/lib/cn";
import { buttonClasses } from "@/components/ui/Button";
import { ThemeToggle } from "./ThemeToggle";
import { NAV_ITEMS } from "./nav-items";

export function Header() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  // Close the mobile menu when the route changes, adjusted during render
  // (React's "adjusting state when a prop changes" pattern) rather than in
  // an effect.
  const [lastPathname, setLastPathname] = useState(pathname);
  if (pathname !== lastPathname) {
    setLastPathname(pathname);
    setMobileOpen(false);
  }

  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-surface/95 shadow-e1 backdrop-blur supports-[backdrop-filter]:bg-surface/80">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
        <Link
          href="/"
          className="group flex items-center gap-2.5 rounded-md text-base font-semibold tracking-tight text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus-ring)]"
        >
          <span
            aria-hidden="true"
            className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand text-brand-foreground shadow-e1 transition-transform group-hover:scale-105 motion-reduce:group-hover:scale-100"
          >
            <GraduationCap className="h-[1.15rem] w-[1.15rem]" />
          </span>
          <span>ScholarTrack</span>
        </Link>

        {/* The 6-item nav plus the account/staff-portal/theme cluster doesn't fit before `lg` —
            measured via Playwright across the full breakpoint range (see Header responsive-overflow
            fix); `md` left a silent overflow (masked by the global `overflow-x: hidden`) from 768px
            up to ~950px, so the hamburger now covers that whole range instead of switching at `md`. */}
        <nav aria-label="Primary" className="hidden lg:block">
          <ul className="flex items-center gap-1">
            {NAV_ITEMS.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={isActive(item.href) ? "page" : undefined}
                  className={cn(
                    "relative rounded-md px-3 py-2 text-sm font-medium transition-colors duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus-ring)]",
                    isActive(item.href)
                      ? "bg-brand-tint text-brand"
                      : "text-foreground-muted hover:bg-surface-muted hover:text-foreground",
                  )}
                >
                  {item.label}
                  {/* Underline marks the active item in addition to the tint, so
                      the current page isn't signalled by colour alone. */}
                  {isActive(item.href) ? (
                    <span
                      aria-hidden="true"
                      className="absolute inset-x-3 -bottom-0.5 h-0.5 rounded-full bg-brand"
                    />
                  ) : null}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div className="flex items-center gap-2">
          {/* Visibility lives on a wrapping element, not combined with buttonClasses() directly: `cn()`
              is plain clsx (no Tailwind conflict resolution), and buttonClasses() always bakes in a bare
              `inline-flex`, which — because Tailwind emits `.inline-flex` after `.hidden` in its generated
              CSS — permanently wins the cascade over a co-mingled bare `hidden`, at every viewport. That
              silently made these links visible at all widths, including down to 320px. See Header
              responsive-overflow fix. */}
          <div className="hidden lg:block">
            <Link href="/account" className={buttonClasses("ghost", "sm")}>
              <User className="h-4 w-4" aria-hidden="true" />
              {/* Full label needs more room than the nav+toolbar cluster has between `lg` and `xl` —
                  icon-only there, full label once it fits at `xl`. */}
              <span className="hidden xl:inline">Account</span>
              <span className="sr-only xl:hidden">Account</span>
            </Link>
          </div>
          <div className="hidden lg:block">
            <Link href="/staff/login" className={buttonClasses("outline", "sm")}>
              <LogIn className="h-4 w-4" aria-hidden="true" />
              <span className="hidden xl:inline">Staff portal</span>
              <span className="sr-only xl:hidden">Staff portal</span>
            </Link>
          </div>
          <div className="hidden lg:block">
            <ThemeToggle />
          </div>
          <button
            type="button"
            className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-border text-foreground lg:hidden focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus-ring)]"
            aria-expanded={mobileOpen}
            aria-controls="mobile-navigation"
            onClick={() => setMobileOpen((open) => !open)}
          >
            {mobileOpen ? <X className="h-5 w-5" aria-hidden="true" /> : <Menu className="h-5 w-5" aria-hidden="true" />}
            <span className="sr-only">{mobileOpen ? "Close menu" : "Open menu"}</span>
          </button>
        </div>
      </div>

      {mobileOpen ? (
        <nav id="mobile-navigation" aria-label="Mobile" className="border-t border-border bg-surface lg:hidden">
          <ul className="flex flex-col gap-1 px-4 py-3">
            {NAV_ITEMS.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={isActive(item.href) ? "page" : undefined}
                  className={cn(
                    "block rounded-md px-3 py-2.5 text-sm font-medium",
                    isActive(item.href) ? "bg-brand-tint text-brand" : "text-foreground hover:bg-surface-muted",
                  )}
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
          <div className="flex flex-col gap-3 border-t border-border px-4 py-3 lg:hidden">
            <Link href="/account" className={cn(buttonClasses("ghost", "sm"), "w-full justify-center")}>
              <User className="h-4 w-4" aria-hidden="true" />
              Account
            </Link>
            <Link href="/staff/login" className={cn(buttonClasses("outline", "sm"), "w-full justify-center")}>
              <LogIn className="h-4 w-4" aria-hidden="true" />
              Staff portal
            </Link>
            <ThemeToggle />
          </div>
        </nav>
      ) : null}
    </header>
  );
}
