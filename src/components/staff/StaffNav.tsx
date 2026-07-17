import Link from "next/link";
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
  type StaffRole,
} from "@/lib/auth/permissions";

interface StaffNavItem {
  href: string;
  label: string;
  visible: (roles: readonly StaffRole[]) => boolean;
}

const NAV_ITEMS: StaffNavItem[] = [
  { href: "/staff", label: "Dashboard", visible: () => true },
  { href: "/staff/opportunities", label: "Opportunities", visible: canCreateDraft },
  { href: "/staff/reviews", label: "Reviews", visible: canCreateDraft },
  { href: "/staff/assignments", label: "Assignments", visible: canAssignReviewers },
  { href: "/staff/organisations", label: "Organisations", visible: canManageOrganisations },
  { href: "/staff/taxonomies", label: "Taxonomies", visible: canManageTaxonomies },
  { href: "/staff/documents", label: "Documents", visible: canManageDocumentsAndEligibility },
  { href: "/staff/eligibility-rules", label: "Eligibility rules", visible: canManageDocumentsAndEligibility },
  { href: "/staff/corrections", label: "Corrections", visible: canTriageCorrections },
  { href: "/staff/duplicates", label: "Duplicates", visible: canManageDuplicates },
  { href: "/staff/discovery", label: "Discovery quality", visible: canCreateDraft },
  { href: "/staff/imports", label: "Imports", visible: canRunImports },
  { href: "/staff/audit", label: "Audit log", visible: canViewFullAuditLog },
  { href: "/staff/team", label: "Team", visible: canManageStaff },
  { href: "/staff/ai", label: "AI assistant", visible: canManageAiSources },
  { href: "/staff/ai/sources", label: "AI sources", visible: canManageAiSources },
  { href: "/staff/ai/evaluations", label: "AI evaluations", visible: canRunAiEvaluations },
  { href: "/staff/ai/usage", label: "AI usage", visible: canViewAiUsage },
  { href: "/staff/ai/safety", label: "AI safety log", visible: canViewAiSafetyLog },
];

interface StaffNavProps {
  roles: readonly StaffRole[];
  displayName: string;
}

/**
 * Filters by role for a cleaner UI only — this is not the security boundary.
 * Every Server Action/Route Handler independently re-checks the same
 * permission function before doing anything (see `src/lib/auth/permissions.ts`).
 */
export function StaffNav({ roles, displayName }: StaffNavProps) {
  const items = NAV_ITEMS.filter((item) => item.visible(roles));

  return (
    <nav
      aria-label="Staff navigation"
      className="flex shrink-0 flex-col gap-1 border-b border-border bg-surface p-4 lg:w-64 lg:border-b-0 lg:border-r"
    >
      <div className="mb-3">
        <p className="text-sm font-semibold text-foreground">{displayName}</p>
        <p className="text-xs text-foreground-muted">{roles.join(", ")}</p>
      </div>

      <ul className="flex flex-col gap-0.5">
        {items.map((item) => (
          <li key={item.href}>
            <Link
              href={item.href}
              className="block rounded-md px-3 py-2 text-sm text-foreground hover:bg-surface-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus-ring)]"
            >
              {item.label}
            </Link>
          </li>
        ))}
      </ul>

      <div className="mt-4 border-t border-border pt-3">
        <Link href="/" className="block rounded-md px-3 py-2 text-sm text-foreground-muted hover:bg-surface-muted">
          Back to public site
        </Link>
        <form action="/staff/logout" method="post">
          <button
            type="submit"
            className="w-full rounded-md px-3 py-2 text-left text-sm text-foreground-muted hover:bg-surface-muted"
          >
            Sign out
          </button>
        </form>
      </div>
    </nav>
  );
}
