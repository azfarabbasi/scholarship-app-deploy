import type { Metadata } from "next";
import { StudentSignupForm } from "@/components/auth/StudentSignupForm";

export const metadata: Metadata = {
  title: "Create an account",
  description: "Create an optional ScholarTrack account for cloud sync across devices.",
  alternates: { canonical: "/auth/signup" },
};

export default function StudentSignupPage() {
  return <StudentSignupForm />;
}
