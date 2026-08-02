import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { getStaffSession } from "@/lib/auth/session";
import { StaffNav } from "@/components/staff/StaffNav";

/**
 * Gates every `/staff/**` route except the public ones (login/callback/
 * unauthorized/logout, which live outside this route group so this layout
 * never wraps them). Middleware already redirects a fully unauthenticated
 * visitor to `/staff/login`; this layout additionally rejects an
 * authenticated visitor who holds no active staff role assignment —
 * "authenticated but unassigned" must never reach any staff page.
 */
export default async function ProtectedStaffLayout({ children }: { children: ReactNode }) {
  const session = await getStaffSession();

  if (!session) {
    redirect("/staff/unauthorized");
  }

  return (
    <div className="flex min-h-screen flex-col lg:flex-row">
      <StaffNav
        roles={session.roles}
        displayName={session.displayName}
        isBootstrapAdmin={session.isBootstrapAdmin}
      />
      <main className="min-w-0 flex-1 p-4 sm:p-6 lg:p-8">{children}</main>
    </div>
  );
}
