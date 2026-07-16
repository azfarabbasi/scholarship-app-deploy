import { Suspense } from "react";
import { StaffLoginForm } from "@/components/staff/StaffLoginForm";

export default function StaffLoginPage() {
  return (
    <Suspense fallback={null}>
      <StaffLoginForm />
    </Suspense>
  );
}
