"use client";

import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { navMenuItemClassName } from "@/components/nav-menu-styles";

export function SignOutButton() {
  const router = useRouter();

  async function handleSignOut() {
    await authClient.signOut();
    router.refresh();
  }

  return (
    <DropdownMenuItem onSelect={handleSignOut} className={navMenuItemClassName}>
      Sign out
    </DropdownMenuItem>
  );
}
