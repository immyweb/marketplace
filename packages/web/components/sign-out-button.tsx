"use client";

import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";

export function SignOutButton() {
  const router = useRouter();

  async function handleSignOut() {
    await authClient.signOut();
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={handleSignOut}
      className="cursor-pointer font-mono text-sm tracking-wide uppercase hover:text-accent"
    >
      Sign out
    </button>
  );
}
