import type { Metadata } from "next";
import { AuthLayout } from "@/components/auth-layout";
import { SignInForm } from "@/app/sign-in/_components";

export const metadata: Metadata = { title: "Sign In" };

export default function SignInPage() {
  return (
    <AuthLayout
      eyebrow="Welcome Back"
      headline="Pick Up Where You Left Off"
      supportText="Your cart and order history are right where you left them."
    >
      <SignInForm />
    </AuthLayout>
  );
}
