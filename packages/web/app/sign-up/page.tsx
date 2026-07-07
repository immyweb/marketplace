import type { Metadata } from "next";
import { AuthLayout } from "@/components/auth-layout";
import { SignUpForm } from "@/app/sign-up/_components";

export const metadata: Metadata = { title: "Sign Up" };

export default function SignUpPage() {
  const establishedStamp = `Established ${new Date().toLocaleDateString("en-GB", { month: "long", year: "numeric" })}`;

  return (
    <AuthLayout
      eyebrow="Member Ledger"
      headline="Open Your Account"
      supportText="Save your fit, track orders, and breeze through checkout next time."
      stamp={establishedStamp}
    >
      <SignUpForm />
    </AuthLayout>
  );
}
