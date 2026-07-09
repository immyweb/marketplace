# Top Nav Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Consolidate the signed-in nav's "Orders" link and sign-out control into a hover/tap dropdown off the user's name, and add a visual divider between the account cluster and Cart in both signed-in and signed-out states.

**Architecture:** A new client component, `AccountMenu`, wraps the existing Radix-based `DropdownMenu` primitive (`components/ui/dropdown-menu.tsx`) in controlled mode, opening on hover (with a short close delay) while still supporting click/tap and keyboard via Radix's own toggle. `components/nav.tsx` (a Server Component) renders `AccountMenu` when signed in instead of the current inline `Orders`/`SignOutButton` row. `SignOutButton` is restyled to render as a `DropdownMenuItem` since its only consumer is now inside the dropdown.

**Tech Stack:** Next.js (Server Components), React, Radix UI (`dropdown-menu` primitive, already vendored), Tailwind CSS, `lucide-react` icons, Vitest + React Testing Library + `@testing-library/user-event` + MSW for component tests.

## Global Constraints

- Design spec: `docs/superpowers/specs/2026-07-09-top-nav-redesign-design.md`.
- "Sign in" stays a plain `Link`, not a `Button` (per user correction during brainstorming).
- Dropdown hover-close delay: ~150ms.
- No new E2E test — this is not a checkout/cart/payment/auth-critical flow (ADR 001).
- Follow existing file conventions: `"use client"` only on the interactive leaf components, not on `nav.tsx` itself.

---

### Task 1: Hover dropdown for signed-in nav + visual divider

**Files:**

- Create: `packages/web/components/account-menu.tsx`
- Modify: `packages/web/components/sign-out-button.tsx`
- Modify: `packages/web/components/nav.tsx`
- Test: `packages/web/tests/component/nav.test.tsx`

**Interfaces:**

- Consumes: `DropdownMenu`, `DropdownMenuTrigger`, `DropdownMenuContent`, `DropdownMenuItem`, `DropdownMenuSeparator` from `@/components/ui/dropdown-menu` (existing, unchanged). `ChevronDownIcon` from `lucide-react` (existing dependency, already used in `sort-select.tsx`).
- Produces: `AccountMenu({ name }: { name: string })` — a named export `AccountMenu`, rendered by `nav.tsx` as `<AccountMenu name={session.user.name} />` when `session` is truthy. `SignOutButton` keeps its existing no-prop signature (`<SignOutButton />`) but now renders a `DropdownMenuItem` (role `menuitem`) instead of a `<button>`.

- [ ] **Step 1: Write the failing test**

Replace the full contents of `packages/web/tests/component/nav.test.tsx` with:

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { server } from "./setup";
import { Nav } from "@/components/nav";

const API_URL = "http://localhost:3001";

vi.mock("next/headers", () => ({
  headers: () => Promise.resolve(new Headers()),
}));

vi.mock("next/navigation", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/navigation")>()),
  useRouter: () => ({ refresh: vi.fn() }),
}));

describe("Nav", () => {
  it("shows a sign-in link when logged out", async () => {
    server.use(
      http.get(`${API_URL}/api/auth/get-session`, () =>
        HttpResponse.json(null),
      ),
    );

    render(await Nav());

    expect(screen.getByRole("link", { name: "Sign in" })).toBeInTheDocument();
    expect(screen.queryByText("Sign out")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: "Orders" }),
    ).not.toBeInTheDocument();
  });

  it("shows the user's name, and opening the account menu reveals Orders and Sign out", async () => {
    server.use(
      http.get(`${API_URL}/api/auth/get-session`, () =>
        HttpResponse.json({
          session: {
            id: "s1",
            userId: "u1",
            expiresAt: new Date().toISOString(),
          },
          user: { id: "u1", name: "Ada", email: "ada@example.com" },
        }),
      ),
    );

    render(await Nav());

    expect(
      screen.queryByRole("link", { name: "Sign in" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("menuitem", { name: "Orders" }),
    ).not.toBeInTheDocument();

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /Ada/ }));

    expect(screen.getByRole("menuitem", { name: "Orders" })).toHaveAttribute(
      "href",
      "/orders",
    );
    expect(
      screen.getByRole("menuitem", { name: "Sign out" }),
    ).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd packages/web && npx vitest run tests/component/nav.test.tsx`
Expected: FAIL on the second test — `screen.getByRole("button", { name: /Ada/ })` throws because the name currently renders as a plain `<span>`, not a button.

- [ ] **Step 3: Restyle `SignOutButton` as a dropdown menu item**

Replace the full contents of `packages/web/components/sign-out-button.tsx`:

```tsx
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
```

- [ ] **Step 4: Create `AccountMenu`**

Create `packages/web/components/account-menu.tsx`:

```tsx
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
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger
        onMouseEnter={() => {
          cancelClose();
          setOpen(true);
        }}
        onMouseLeave={scheduleClose}
        className="flex cursor-pointer items-center gap-1 font-mono text-sm tracking-wide uppercase outline-none hover:text-accent"
      >
        {name}
        <ChevronDownIcon className="size-4" />
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        onMouseEnter={cancelClose}
        onMouseLeave={scheduleClose}
      >
        <DropdownMenuItem asChild>
          <Link href="/orders">Orders</Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <SignOutButton />
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
```

- [ ] **Step 5: Wire `AccountMenu` into `nav.tsx` and add the divider**

In `packages/web/components/nav.tsx`, replace the import of `SignOutButton` with `AccountMenu`, and replace the signed-in/signed-out block. Full new contents:

```tsx
import Link from "next/link";
import { headers } from "next/headers";
import { fetchCart } from "@/lib/api";
import { getServerSession } from "@/lib/get-server-session";
import { AccountMenu } from "@/components/account-menu";

export async function Nav() {
  let itemCount = 0;
  try {
    // SSR fetches have no browser cookie jar — forward the incoming
    // request's Cookie header so the API sees the visitor's session.
    const cookie = (await headers()).get("cookie");
    const cart = await fetchCart(
      cookie ? { headers: { Cookie: cookie } } : undefined,
    );
    itemCount = cart.items.reduce((sum, item) => sum + item.quantity, 0);
  } catch {
    // cart fetch fails gracefully — show 0
  }

  const session = await getServerSession();

  return (
    <header className="bg-primary text-primary-foreground">
      <nav
        aria-label="Main navigation"
        className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6"
      >
        <Link
          href="/"
          className="font-display text-lg font-bold tracking-wide uppercase"
        >
          Marketplace <span className="text-accent">·</span> Goods
        </Link>
        <div className="flex items-center gap-8">
          {session ? (
            <AccountMenu name={session.user.name} />
          ) : (
            <Link
              href="/sign-in"
              className="font-mono text-sm tracking-wide uppercase hover:text-accent"
            >
              Sign in
            </Link>
          )}
          <Link
            href="/cart"
            aria-label={`Cart, ${itemCount} item${itemCount !== 1 ? "s" : ""}`}
            className="border-l border-primary-foreground/30 pl-6 font-mono text-sm tracking-wide uppercase hover:text-accent"
          >
            Cart
            <span
              aria-hidden="true"
              className="ml-1.5 rounded-sm bg-accent px-1.5 py-0.5 text-xs text-foreground"
            >
              {itemCount}
            </span>
          </Link>
        </div>
      </nav>
    </header>
  );
}
```

- [ ] **Step 6: Run the test to verify it passes**

Run: `cd packages/web && npx vitest run tests/component/nav.test.tsx`
Expected: PASS — both tests green.

- [ ] **Step 7: Run the full web component test suite**

Run: `cd packages/web && npx vitest run`
Expected: PASS — no regressions in other component tests (e.g. `sort-select`-adjacent product tests, if any import `nav.tsx` indirectly via layout).

- [ ] **Step 8: Manual verification in the dev server**

Run: `cd packages/web && npm run dev` (or the repo's existing dev script), then in a browser:

- Signed out: confirm "Sign in" link and "Cart" are separated by a visible divider, with reasonable spacing.
- Signed in: hover over the name — the dropdown should open showing "Orders" and "Sign out", and stay open when moving the pointer from the name into the menu. Moving the pointer away from both should close it after a brief delay. Clicking/tapping the name should also toggle it. Confirm "Orders" navigates to `/orders` and "Sign out" signs out.

Stop the dev server after checking.

- [ ] **Step 9: Commit**

```bash
git add packages/web/components/account-menu.tsx packages/web/components/sign-out-button.tsx packages/web/components/nav.tsx packages/web/tests/component/nav.test.tsx
git commit -m "Redesign nav: hover dropdown for account links, add cart divider"
```
