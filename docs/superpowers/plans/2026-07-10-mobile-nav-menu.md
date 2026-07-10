# Mobile Nav Burger Menu Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the top-nav account area with a burger-triggered menu below the `sm` breakpoint (640px), while keeping Cart always visible on every screen size.

**Architecture:** Extract the branded dropdown-menu styling (already duplicated once, in `account-menu.tsx` and `sign-out-button.tsx`) into a shared constants module, then build a new `MobileNavMenu` client component — tap-driven and uncontrolled, unlike the hover-driven `AccountMenu` — and render both the existing desktop cluster and the new mobile trigger simultaneously in `Nav`, letting `hidden sm:block` / `sm:hidden` decide which shows.

**Tech Stack:** Next.js 16 App Router, TypeScript, Tailwind v4, Radix `DropdownMenu` (via the `radix-ui` package, wrapped in `packages/web/components/ui/dropdown-menu.tsx`), lucide-react icons, Vitest + React Testing Library (`packages/web/components/nav.test.tsx`).

## Global Constraints

- Breakpoint: `sm` (640px) — the same cutoff already used in `nav.tsx`/`footer.tsx`. Below it, show the burger; at and above it, show the existing desktop cluster.
- Cart stays visible at all times, on every screen size — only the account area (sign-in link / account name) collapses into the burger.
- The burger is always a menu, in both auth states — it never collapses to a bare link. Signed out: one "Sign in" item. Signed in: an account-name label, "Orders", "Sign out".
- No new E2E coverage — nav is not a checkout/cart/payment/auth-critical flow per ADR 001; mocked-session component tests in `nav.test.tsx` are sufficient.
- **Never commit.** Per project `CLAUDE.md` Rule 6, this overrides the plan template's default per-task commit step — leave every task's changes uncommitted in the working tree for user review. Do not run `git add` or `git commit` at any point in this plan.
- All commands below are run with `packages/web` as the working directory unless stated otherwise.

---

### Task 1: Extract shared branded dropdown-menu styling

**Files:**

- Create: `components/nav-menu-styles.ts`
- Modify: `components/account-menu.tsx`
- Modify: `components/sign-out-button.tsx`

**Interfaces:**

- Consumes: nothing from other tasks — first task.
- Produces: three exported string constants from `components/nav-menu-styles.ts` — `navDropdownContentClassName`, `navMenuItemClassName`, `navDropdownSeparatorClassName` — consumed by Task 2's `MobileNavMenu`.

This is a pure refactor (no behavior change): `account-menu.tsx` and `sign-out-button.tsx` each currently hold their own copy of the same branded item class string. A third consumer (`MobileNavMenu`, next task) is about to need it too, so this extracts it first rather than duplicating a third time.

- [ ] **Step 1: Create the shared styles module**

Create `components/nav-menu-styles.ts`:

```ts
export const navDropdownContentClassName =
  "min-w-40 rounded-sm p-1.5 shadow-[3px_3px_0_0_rgba(38,35,31,0.1),0_12px_28px_-16px_rgba(38,35,31,0.5)]";

export const navMenuItemClassName =
  "cursor-pointer border-l-2 border-l-transparent font-mono text-xs tracking-widest uppercase transition-colors focus:border-l-accent focus:bg-accent/10 focus:text-primary";

export const navDropdownSeparatorClassName =
  "-mx-1.5 my-1.5 h-px border-t border-dashed border-border bg-transparent";
```

- [ ] **Step 2: Update `account-menu.tsx` to import instead of duplicate**

In `components/account-menu.tsx`, change:

```tsx
import { SignOutButton } from "@/components/sign-out-button";
import { cn } from "@/lib/utils";

const CLOSE_DELAY_MS = 150;

const menuItemClassName =
  "cursor-pointer border-l-2 border-l-transparent font-mono text-xs tracking-widest uppercase transition-colors focus:border-l-accent focus:bg-accent/10 focus:text-primary";
```

to:

```tsx
import { SignOutButton } from "@/components/sign-out-button";
import { cn } from "@/lib/utils";
import {
  navDropdownContentClassName,
  navDropdownSeparatorClassName,
  navMenuItemClassName,
} from "@/components/nav-menu-styles";

const CLOSE_DELAY_MS = 150;
```

Then change:

```tsx
      <DropdownMenuContent
        align="end"
        onMouseEnter={cancelClose}
        onMouseLeave={scheduleClose}
        className="min-w-40 rounded-sm p-1.5 shadow-[3px_3px_0_0_rgba(38,35,31,0.1),0_12px_28px_-16px_rgba(38,35,31,0.5)]"
      >
        <DropdownMenuItem asChild className={menuItemClassName}>
          <Link href="/orders">Orders</Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator className="-mx-1.5 my-1.5 h-px border-t border-dashed border-border bg-transparent" />
```

to:

```tsx
      <DropdownMenuContent
        align="end"
        onMouseEnter={cancelClose}
        onMouseLeave={scheduleClose}
        className={navDropdownContentClassName}
      >
        <DropdownMenuItem asChild className={navMenuItemClassName}>
          <Link href="/orders">Orders</Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator className={navDropdownSeparatorClassName} />
```

- [ ] **Step 3: Update `sign-out-button.tsx` to import instead of duplicate**

In `components/sign-out-button.tsx`, change:

```tsx
import { authClient } from "@/lib/auth-client";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";

// Mirrors account-menu.tsx's menuItemClassName — kept as a duplicate literal
// rather than a shared import to avoid a circular dependency (account-menu
// imports SignOutButton).
const menuItemClassName =
  "cursor-pointer border-l-2 border-l-transparent font-mono text-xs tracking-widest uppercase transition-colors focus:border-l-accent focus:bg-accent/10 focus:text-primary";

export function SignOutButton() {
```

to:

```tsx
import { authClient } from "@/lib/auth-client";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { navMenuItemClassName } from "@/components/nav-menu-styles";

export function SignOutButton() {
```

Then change:

```tsx
    <DropdownMenuItem onSelect={handleSignOut} className={menuItemClassName}>
```

to:

```tsx
    <DropdownMenuItem onSelect={handleSignOut} className={navMenuItemClassName}>
```

- [ ] **Step 4: Verify no regression**

Run: `bunx vitest run components/nav.test.tsx`
Expected: PASS, same 2 tests as before (this task changes no behavior, only where the class strings live).

Run: `bunx tsc --noEmit`
Expected: no errors (confirms the new import paths resolve and no orphaned identifiers remain — neither file should still reference a local `menuItemClassName`).

---

### Task 2: Build `MobileNavMenu` and wire it into `Nav`

**Files:**

- Modify: `components/nav.test.tsx`
- Create: `components/mobile-nav-menu.tsx`
- Modify: `components/nav.tsx`

**Interfaces:**

- Consumes: `navDropdownContentClassName`, `navMenuItemClassName`, `navDropdownSeparatorClassName` from `components/nav-menu-styles.ts` (Task 1); `SignOutButton` from `components/sign-out-button.tsx` (pre-existing, unchanged); `getServerSession`'s `ServerSession | null` return shape from `lib/get-server-session.ts` (pre-existing) — specifically `session.user.name: string`.
- Produces: `MobileNavMenu({ name }: { name: string | null })` from `components/mobile-nav-menu.tsx`. `name: null` renders the signed-out state (one "Sign in" item); a non-null `name` renders the signed-in state (name label, "Orders", "Sign out"). No other task consumes this — it's the end of this plan's dependency chain.

- [ ] **Step 1: Write the failing tests**

In `components/nav.test.tsx`, add `within` to the RTL import:

```tsx
import { render, screen, within } from "@testing-library/react";
```

Then add two new `it` blocks inside the existing `describe("Nav", ...)`, after the current two tests (before the closing `});`):

```tsx
it("mobile: shows a Sign in item after opening the menu when logged out", async () => {
  server.use(
    http.get(`${API_URL}/api/auth/get-session`, () => HttpResponse.json(null)),
  );

  render(await Nav());

  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: "Open menu" }));

  expect(screen.getByRole("menuitem", { name: "Sign in" })).toHaveAttribute(
    "href",
    "/sign-in",
  );
});

it("mobile: shows the account name, Orders, and Sign out after opening the menu when logged in", async () => {
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

  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: "Open menu" }));

  // Scoped to the open menu: the desktop AccountMenu trigger also renders
  // "Ada" as its always-visible label (unrelated to whether its own
  // dropdown is open), so an unscoped query would match both.
  const menu = screen.getByRole("menu");
  expect(within(menu).getByText("Ada")).toBeInTheDocument();
  expect(
    within(menu).getByRole("menuitem", { name: "Orders" }),
  ).toHaveAttribute("href", "/orders");
  expect(
    within(menu).getByRole("menuitem", { name: "Sign out" }),
  ).toBeInTheDocument();
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `bunx vitest run components/nav.test.tsx`
Expected: FAIL — the two new tests fail with something like "Unable to find an accessible element with the role \"button\" and name \"Open menu\"" (the mobile trigger doesn't exist yet). The original two tests still PASS.

- [ ] **Step 3: Create `MobileNavMenu`**

Create `components/mobile-nav-menu.tsx`:

```tsx
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
```

- [ ] **Step 4: Wire `MobileNavMenu` into `Nav`**

In `components/nav.tsx`, add the import:

```tsx
import { AccountMenu } from "@/components/account-menu";
import { MobileNavMenu } from "@/components/mobile-nav-menu";
```

Then change:

```tsx
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
```

to:

```tsx
        <div className="flex items-center gap-8">
          <div className="hidden sm:block">
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
          </div>
          <div className="sm:hidden">
            <MobileNavMenu name={session?.user.name ?? null} />
          </div>
          <Link
```

(The closing `</Link>` for Cart and the outer `</div>` are unchanged — only the two new wrapper `<div>`s are added around the existing account-area markup.)

- [ ] **Step 5: Run the tests to verify they pass**

Run: `bunx vitest run components/nav.test.tsx`
Expected: PASS — all 4 tests (the original 2 plus the 2 new mobile ones).

- [ ] **Step 6: Typecheck**

Run: `bunx tsc --noEmit`
Expected: no errors.

---

### Task 3: Final verification

**Files:** none (verification only — no code changes).

**Interfaces:**

- Consumes: the completed, verified state of Tasks 1–2.
- Produces: nothing.

- [ ] **Step 1: Run the full component test suite**

Run: `bun run test`
Expected: all tests PASS, 2 more than the pre-plan baseline (the two new mobile-menu cases in `nav.test.tsx`).

- [ ] **Step 2: Typecheck the whole package**

Run: `bunx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Manual check in the dev server**

With `bun run dev` running (or the already-running dev server), open `http://localhost:3000/` in a browser and, using devtools' device toolbar (or a real narrow window) to go below 640px wide:

- Confirm the desktop account cluster is gone and a burger icon (`MenuIcon`) sits where it was; Cart is still visible.
- Tap the burger: it opens the panel, the icon swaps to `XIcon`, and — signed out — shows a single "Sign in" item; signed in (sign up/sign in via the UI first), shows the account name, "Orders", and "Sign out".
- Press Escape while the panel is open: it closes and focus returns to the trigger.
- Resize back above 640px: the burger disappears and the original desktop cluster (name-dropdown or "Sign in" link) reappears; Cart is unaffected throughout.

- [ ] **Step 4: Accessibility audit**

Run the `accesslint:diff` skill against `http://localhost:3000/` (default stash-mode diff — Tasks 1–2's changes are still uncommitted at this point per the Global Constraints, so this correctly diffs the new mobile menu against the pre-change baseline). Cover both auth states with the mobile panel open per the design spec's Testing section (`docs/superpowers/specs/2026-07-10-mobile-nav-menu-design.md`).

Expected: 0 new violations. If any appear, they block completion — fix them before moving on (do not commit past a new violation).

- [ ] **Step 5: Summarize for review**

Run: `git status --short` and `git diff --stat`
Expected: `components/nav-menu-styles.ts` (new), `components/mobile-nav-menu.tsx` (new), and modifications to `components/account-menu.tsx`, `components/sign-out-button.tsx`, `components/nav.tsx`, `components/nav.test.tsx`. Report this summary to the user — per `CLAUDE.md` Rule 6, everything stays uncommitted until they review and explicitly ask for a commit.

---

## Self-Review

**Spec coverage:** Breakpoint (`sm`/640px) — Task 2 Step 4. Cart always visible — Task 2 Step 4 (Cart markup untouched, only account area wrapped). Burger always a menu, never a bare link — `MobileNavMenu`'s `name ? ... : ...` branch, both sides render a `DropdownMenuItem` inside the same trigger/panel shape, never a plain `Link` swapped in for the trigger. Separate component, not a responsive variant of `AccountMenu` — Task 2 Step 3, uncontrolled + default `modal`, no hover timers. Name label in signed-in panel — `DropdownMenuLabel` in Task 2 Step 3. Shared-styles extraction — Task 1, consumed by both existing files and the new component. Testing (component tests, no E2E, accessibility audit) — Task 2 Step 1 and Task 3 Steps 1 and 4.

**Placeholder scan:** No TBD/TODO. Every step shows exact before/after code or an exact command with expected output.

**Type consistency:** `MobileNavMenu`'s prop is `{ name: string | null }` everywhere it's defined (Task 2 Step 3) and everywhere it's called (Task 2 Step 4, `session?.user.name ?? null` — matches `ServerSession`'s `user: { name: string }` shape from `lib/get-server-session.ts`, narrowed through the optional chain to `string | null`). The three shared class constants (`navDropdownContentClassName`, `navMenuItemClassName`, `navDropdownSeparatorClassName`) are named identically in their Task 1 definition and every Task 1/Task 2 consumer.
