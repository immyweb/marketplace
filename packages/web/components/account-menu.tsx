"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ChevronDownIcon } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SignOutButton } from "@/components/sign-out-button";
import { cn } from "@/lib/utils";
import {
  navDropdownContentClassName,
  navDropdownSeparatorClassName,
  navMenuItemClassName,
} from "@/components/nav-menu-styles";

const CLOSE_DELAY_MS = 150;

export function AccountMenu({ name }: { name: string }) {
  const [open, setOpen] = useState(false);
  const closeTimeout = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );

  useEffect(() => () => clearTimeout(closeTimeout.current), []);

  function cancelClose() {
    clearTimeout(closeTimeout.current);
  }

  function scheduleClose() {
    cancelClose();
    closeTimeout.current = setTimeout(() => setOpen(false), CLOSE_DELAY_MS);
  }

  return (
    // modal={false}: this is a hover-driven nav flyout, not a dialog. The
    // DropdownMenu default (modal=true) disables pointer-events on <body>
    // while open — since the trigger is a body descendant, not inside the
    // portaled content, that kills hover on the trigger itself and causes
    // an open->close->open flicker loop under a perfectly stationary
    // cursor (pointer-events:none makes the browser fire pointerleave,
    // which schedules a close; closing restores pointer-events, which
    // fires pointerenter again under the same unmoved cursor; repeat).
    // Non-modal also stops it from trapping focus or locking page scroll,
    // neither of which is wanted for a small flyout menu anyway.
    <DropdownMenu open={open} onOpenChange={setOpen} modal={false}>
      <DropdownMenuTrigger
        onMouseEnter={() => {
          cancelClose();
          setOpen(true);
        }}
        onMouseLeave={scheduleClose}
        className="flex cursor-pointer items-center gap-1.5 rounded-sm font-mono text-sm tracking-wide uppercase outline-none hover:text-accent focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
      >
        {name}
        <ChevronDownIcon
          className={cn(
            "size-4 transition-transform duration-200",
            open && "rotate-180",
          )}
        />
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        onMouseEnter={cancelClose}
        onMouseLeave={scheduleClose}
        className={navDropdownContentClassName}
      >
        <DropdownMenuItem asChild className={navMenuItemClassName}>
          <Link href="/my-details">My Details</Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild className={navMenuItemClassName}>
          <Link href="/orders">Orders</Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator className={navDropdownSeparatorClassName} />
        <SignOutButton />
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
