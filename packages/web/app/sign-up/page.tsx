import type { Metadata } from "next";
import { SignUpForm } from "@/app/sign-up/_components";

export const metadata: Metadata = { title: "Sign Up" };

export default function SignUpPage() {
  return <SignUpForm />;
}
