"use client";

import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";

export function SignOutButton() {
  const router = useRouter();

  async function handleSignOut() {
    await authClient.signOut();
    router.refresh();
  }

  return (
    <DropdownMenuItem onSelect={handleSignOut} className="cursor-pointer">
      Sign out
    </DropdownMenuItem>
  );
}
