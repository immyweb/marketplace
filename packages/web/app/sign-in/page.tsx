import type { Metadata } from "next";
import { SignInForm } from "@/app/sign-in/_components";

export const metadata: Metadata = { title: "Sign In" };

export default function SignInPage() {
  return <SignInForm />;
}
