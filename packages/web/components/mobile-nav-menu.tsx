"use client";

import { useState } from "react";
import Link from "next/link";
import { MenuIcon, XIcon } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SignOutButton } from "@/components/sign-out-button";
import {
  navDropdownContentClassName,
  navDropdownSeparatorClassName,
  navMenuItemClassName,
} from "@/components/nav-menu-styles";

export function MobileNavMenu({ name }: { name: string | null }) {
  const [open, setOpen] = useState(false);

  return (
    // onOpenChange without a controlled `open` prop keeps this uncontrolled
    // — Radix owns open/close state (default modal=true: focus trap,
    // Escape-to-close, scroll lock, all fine for a tap trigger), we just
    // mirror it locally to swap the trigger icon and its aria-label.
    <DropdownMenu onOpenChange={setOpen}>
      <DropdownMenuTrigger
        aria-label={open ? "Close menu" : "Open menu"}
        className="flex cursor-pointer items-center justify-center rounded-sm p-1 outline-none hover:text-accent focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
      >
        {open ? <XIcon className="size-5" /> : <MenuIcon className="size-5" />}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className={navDropdownContentClassName}>
        {name ? (
          <>
            <DropdownMenuLabel className="px-2 py-1.5 font-mono text-xs tracking-widest text-muted-foreground uppercase">
              {name}
            </DropdownMenuLabel>
            <DropdownMenuSeparator className={navDropdownSeparatorClassName} />
            <DropdownMenuItem asChild className={navMenuItemClassName}>
              <Link href="/orders">Orders</Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator className={navDropdownSeparatorClassName} />
            <SignOutButton />
          </>
        ) : (
          <DropdownMenuItem asChild className={navMenuItemClassName}>
            <Link href="/sign-in">Sign in</Link>
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
