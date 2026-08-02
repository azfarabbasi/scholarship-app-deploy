"use client";

import {
  Activity,
  Bot,
  Building2,
  CalendarCheck,
  ClipboardCheck,
  Copy,
  ExternalLink,
  FileText,
  FlaskConical,
  Gauge,
  LayoutDashboard,
  ListChecks,
  LogOut,
  MessageSquareWarning,
  ScrollText,
  Search,
  ShieldAlert,
  Sparkles,
  Tags,
  Upload,
  Users,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Badge } from "@/components/ui/Badge";
import { cn } from "@/lib/cn";
import {
  canAssignReviewers,
  canCreateDraft,
  canManageAiSources,
  canManageDocumentsAndEligibility,
  canManageDuplicates,
  canManageOrganisations,
  canManageStaff,
  canManageTaxonomies,
  canRunAiEvaluations,
  canRunImports,
  canTriageCorrections,
  canViewAiSafetyLog,
  canViewAiUsage,
  canViewFullAuditLog,
  canViewOpsDiagnostics,
  type StaffRole,
} from "@/lib/auth/permissions";

interface StaffNavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  visible: (roles: readonly StaffRole[]) => boolean;
}

interface StaffNavGroup {
  heading: string;
  items: StaffNavItem[];
}

/**
 * Grouped by the job being done rather than kept as one flat list: at full
 * super-admin permissions this nav is 20 entries, and a single column gave
 * "Taxonomies" the same weight as "Dashboard" with no way to scan for the area
 * you wanted. Group headings are rendered but the permission filtering is
 * unchanged — a group with no visible items disappears entirely.
 */
const NAV_GROUPS: StaffNavGroup[] = [
  {
    heading: "Overview",
    items: [{ href: "/staff", label: "Dashboard", icon: LayoutDashboard, visible: () => true }],
  },
  {
    heading: "Catalogue",
    items: [
      { href: "/staff/opportunities", label: "Opportunities", icon: ListChecks, visible: canCreateDraft },
      { href: "/staff/reviews", label: "Reviews", icon: ClipboardCheck, visible: canCreateDraft },
      { href: "/staff/assignments", label: "Assignments", icon: CalendarCheck, visible: canAssignReviewers },
      { href: "/staff/corrections", label: "Corrections", icon: MessageSquareWarning, visible: canTriageCorrections },
      { href: "/staff/duplicates", label: "Duplicates", icon: Copy, visible: canManageDuplicates },
      { href: "/staff/discovery", label: "Discovery quality", icon: Search, visible: canCreateDraft },
    ],
  },
  {
    heading: "Reference data",
    items: [
      { href: "/staff/organisations", label: "Organisations", icon: Building2, visible: canManageOrganisations },
      { href: "/staff/taxonomies", label: "Taxonomies", icon: Tags, visible: canManageTaxonomies },
      { href: "/staff/documents", label: "Documents", icon: FileText, visible: canManageDocumentsAndEligibility },
      {
        href: "/staff/eligibility-rules",
        label: "Eligibility rules",
        icon: ShieldAlert,
        visible: canManageDocumentsAndEligibility,
      },
      { href: "/staff/imports", label: "Imports", icon: Upload, visible: canRunImports },
    ],
  },
  {
    heading: "Scholarly AI",
    items: [
      { href: "/staff/ai", label: "AI assistant", icon: Sparkles, visible: canManageAiSources },
      { href: "/staff/ai/sources", label: "AI sources", icon: Bot, visible: canManageAiSources },
      { href: "/staff/ai/evaluations", label: "AI evaluations", icon: FlaskConical, visible: canRunAiEvaluations },
      { href: "/staff/ai/usage", label: "AI usage", icon: Gauge, visible: canViewAiUsage },
      { href: "/staff/ai/safety", label: "AI safety log", icon: ShieldAlert, visible: canViewAiSafetyLog },
    ],
  },
  {
    heading: "Administration",
    items: [
      { href: "/staff/team", label: "Team", icon: Users, visible: canManageStaff },
      { href: "/staff/audit", label: "Audit log", icon: ScrollText, visible: canViewFullAuditLog },
      { href: "/staff/ops", label: "Ops diagnostics", icon: Activity, visible: canViewOpsDiagnostics },
    ],
  },
];

interface StaffNavProps {
  roles: readonly StaffRole[];
  displayName: string;
  isBootstrapAdmin: boolean;
}

/**
 * Filters by role for a cleaner UI only — this is not the security boundary.
 * Every Server Action/Route Handler independently re-checks the same
 * permission function before doing anything (see `src/lib/auth/permissions.ts`).
 */
export function StaffNav({ roles, displayName, isBootstrapAdmin }: StaffNavProps) {
  const pathname = usePathname();

  const groups = NAV_GROUPS.map((group) => ({
    ...group,
    items: group.items.filter((item) => item.visible(roles)),
  })).filter((group) => group.items.length > 0);

  // `/staff` would prefix-match every child route, and `/staff/ai` would swallow
  // `/staff/ai/sources` — so the longest matching href wins and only it lights up.
  const activeHref = groups
    .flatMap((group) => group.items)
    .filter((item) => pathname === item.href || pathname.startsWith(`${item.href}/`))
    .sort((a, b) => b.href.length - a.href.length)[0]?.href;

  return (
    <nav
      aria-label="Staff navigation"
      className="flex shrink-0 flex-col gap-1 border-b border-border bg-surface p-4 lg:h-screen lg:w-64 lg:overflow-y-auto lg:border-b-0 lg:border-r lg:sticky lg:top-0"
    >
      <div className="mb-4 flex items-start gap-2.5 rounded-lg border border-border bg-surface-muted/60 p-3">
        <span
          aria-hidden="true"
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand text-sm font-semibold text-brand-foreground"
        >
          {displayName.trim().charAt(0).toUpperCase() || "?"}
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-foreground">{displayName}</p>
          <p className="truncate text-xs text-foreground-muted" title={roles.join(", ")}>
            {roles.join(", ")}
          </p>
          {isBootstrapAdmin ? (
            <Badge tone="amber" className="mt-1.5">
              Bootstrap super admin
            </Badge>
          ) : null}
        </div>
      </div>

      <div className="flex flex-col gap-4">
        {groups.map((group) => (
          <div key={group.heading}>
            <p className="px-3 pb-1.5 text-[0.68rem] font-semibold uppercase tracking-wider text-foreground-subtle">
              {group.heading}
            </p>
            <ul className="flex flex-col gap-0.5">
              {group.items.map((item) => {
                const Icon = item.icon;
                const isActive = item.href === activeHref;
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      aria-current={isActive ? "page" : undefined}
                      className={cn(
                        "flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus-ring)]",
                        isActive
                          ? "bg-brand-tint font-medium text-brand"
                          : "text-foreground-muted hover:bg-surface-muted hover:text-foreground",
                      )}
                    >
                      <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                      <span className="truncate">{item.label}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>

      <div className="mt-4 flex flex-col gap-0.5 border-t border-border pt-3">
        <Link
          href="/"
          className="flex items-center gap-2.5 rounded-md px-3 py-2 text-sm text-foreground-muted transition-colors hover:bg-surface-muted hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus-ring)]"
        >
          <ExternalLink className="h-4 w-4 shrink-0" aria-hidden="true" />
          Back to public site
        </Link>
        <form action="/staff/logout" method="post">
          <button
            type="submit"
            className="flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-left text-sm text-foreground-muted transition-colors hover:bg-danger-tint hover:text-danger focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus-ring)]"
          >
            <LogOut className="h-4 w-4 shrink-0" aria-hidden="true" />
            Sign out
          </button>
        </form>
      </div>
    </nav>
  );
}
