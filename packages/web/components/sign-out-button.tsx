"use client";

import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";

// Mirrors account-menu.tsx's menuItemClassName — kept as a duplicate literal
// rather than a shared import to avoid a circular dependency (account-menu
// imports SignOutButton).
const menuItemClassName =
  "cursor-pointer border-l-2 border-l-transparent font-mono text-xs tracking-widest uppercase transition-colors focus:border-l-accent focus:bg-accent/10 focus:text-primary";

export function SignOutButton() {
  const router = useRouter();

  async function handleSignOut() {
    await authClient.signOut();
    router.refresh();
  }

  return (
    <DropdownMenuItem onSelect={handleSignOut} className={menuItemClassName}>
      Sign out
    </DropdownMenuItem>
  );
}
