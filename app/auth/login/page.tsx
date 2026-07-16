import type { Metadata } from "next";
import { Suspense } from "react";
import { StudentLoginForm } from "@/components/auth/StudentLoginForm";

export const metadata: Metadata = {
  title: "Sign in",
  description: "Sign in to your optional ScholarTrack account for cloud sync across devices.",
  alternates: { canonical: "/auth/login" },
};

export default function StudentLoginPage() {
  return (
    <Suspense fallback={null}>
      <StudentLoginForm />
    </Suspense>
  );
}
