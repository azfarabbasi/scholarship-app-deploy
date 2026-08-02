import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { getStudentSession } from "@/lib/auth/student-session";
import { AccountNav } from "@/components/account/AccountNav";

/**
 * Gates every `/account/**` route. Middleware already redirects a fully
 * signed-out visitor to `/auth/login`; this layout additionally resolves
 * (and lazily provisions) the student's profile row — every signed-in
 * Supabase user is a valid student here, unlike staff, which requires an
 * explicit role assignment. Being staff never implies anything here, and
 * vice versa (see `docs/checkpoint-3/checkpoint-3-architecture.md`).
 */
export default async function AccountLayout({ children }: { children: ReactNode }) {
  const session = await getStudentSession();

  if (!session) {
    redirect("/auth/login?next=/account");
  }

  return (
    <div className="flex min-h-screen flex-col lg:flex-row">
      <AccountNav email={session.email} displayName={session.displayName} studentProfileId={session.studentProfileId} />
      <main className="min-w-0 flex-1 p-4 sm:p-6 lg:p-8">{children}</main>
    </div>
  );
}
