# Mobile Nav Burger Menu

**Date:** 2026-07-10
**Status:** Draft

## Context

`components/nav.tsx` renders the top-right cluster as an always-inline row: the account area (`AccountMenu` when signed in, a plain "Sign in" link when signed out) next to a "Cart" link with an item-count badge. On narrow viewports this row is cramped, especially with a long account name. This design swaps just the account area for a burger-triggered menu below the `sm` breakpoint (640px — the cutoff already used elsewhere in `nav.tsx`/`footer.tsx`); Cart stays visible at all times, on every screen size, since shoppers expect to see and reach their cart without an extra tap.

This builds on the branded `DropdownMenu` styling introduced in the account-menu redesign (sharp corners, hard-offset "stamped tag" shadow, mono/uppercase items, dashed stitch separator, brass hover/focus tick) — see `components/account-menu.tsx` and `components/sign-out-button.tsx` for the existing implementation this design extends to a third (and now shared) call site.

## Decision

### Layout: both clusters always render, CSS picks which shows

```tsx
<div className="flex items-center gap-8">
  <div className="hidden sm:block">
    {session ? (
      <AccountMenu name={session.user.name} />
    ) : (
      <Link href="/sign-in">Sign in</Link>
    )}
  </div>
  <div className="sm:hidden">
    <MobileNavMenu name={session?.user.name ?? null} />
  </div>
  <Link href="/cart">Cart …</Link> {/* unchanged */}
</div>
```

Both the desktop account cluster and the new mobile trigger are always present in the DOM; `hidden sm:block` / `sm:hidden` decide which is visible per breakpoint. This avoids any JS-side viewport detection or hydration-mismatch risk — it's the same technique Tailwind responsive utilities are used for elsewhere in this file.

### `MobileNavMenu`: a new, separate client component

New file: `components/mobile-nav-menu.tsx`, taking `{ name }: { name: string | null }` (`null` means signed out).

It is **not** a responsive variant of `AccountMenu` — the two have different interaction models:

- `AccountMenu` is hover-driven (with a controlled `open`/`onOpenChange`, a close-delay timer, and `modal={false}` to avoid a pointer-events flicker bug — see the comment in `account-menu.tsx`). That workaround exists specifically because a mouse user has no click affordance otherwise.
- `MobileNavMenu` is tap-only. It uses the Radix `DropdownMenu` **uncontrolled**, with its default `modal` behavior (focus trap, Escape-to-close, scroll lock) — all appropriate for a touch context and none of them problematic the way they are for a hover trigger. No custom timers or state needed beyond tracking open/closed for the icon swap.

**Trigger:** an icon-only button — `MenuIcon` (lucide-react) when closed, `XIcon` when open — `aria-label="Open menu"` / `"Close menu"` respectively. Styled to match the existing nav link treatment (`hover:text-accent`, the same `focus-visible` ring as `AccountMenu`'s trigger).

**Panel content, signed out:**

```
┌────────────┐
│ SIGN IN    │
└────────────┘
```

One item, linking to `/sign-in`.

**Panel content, signed in:**

```
┌────────────────┐
│ DESIGN REVIEWER │  ← DropdownMenuLabel, name, uppercase mono eyebrow
│ ╌╌╌╌╌╌╌╌╌╌╌╌╌╌ │
│ ORDERS          │
│ ╌╌╌╌╌╌╌╌╌╌╌╌╌╌ │
│ SIGN OUT        │
└────────────────┘
```

Same two actions as `AccountMenu` today (Orders, Sign out), plus a name label at the top (`DropdownMenuLabel`, already defined in `components/ui/dropdown-menu.tsx` but currently unused elsewhere) so a signed-in user can still confirm which account they're in without the name being visible in the collapsed top bar.

The menu is always a menu — logged in or out, tapping the burger opens the same panel shape, just with different contents. It never collapses to a bare link, so the top-right icon slot is predictable regardless of auth state.

### Shared styling: extracted, not duplicated a third time

`account-menu.tsx` and `sign-out-button.tsx` currently each hold a duplicated copy of the same branded item class string (a deliberate choice at the time, flagged as a to-resolve-later duplication in the style of ADR 007's stamp-motif note). `MobileNavMenu` needs the same item styling, the same panel-content styling, and the same dashed-separator styling — a third and, across its two internal items, fourth copy. That's the threshold ADR 007 itself names for the stamp motif ("before adding a fourth instance, resolve this deliberately"), so this design extracts instead of duplicating again:

New file: `components/nav-menu-styles.ts` — plain exported string constants, not a component:

```ts
export const navDropdownContentClassName =
  "min-w-40 rounded-sm p-1.5 shadow-[3px_3px_0_0_rgba(38,35,31,0.1),0_12px_28px_-16px_rgba(38,35,31,0.5)]";
export const navMenuItemClassName =
  "cursor-pointer border-l-2 border-l-transparent font-mono text-xs tracking-widest uppercase transition-colors focus:border-l-accent focus:bg-accent/10 focus:text-primary";
export const navDropdownSeparatorClassName =
  "-mx-1.5 my-1.5 h-px border-t border-dashed border-border bg-transparent";
```

Imported by `account-menu.tsx`, `sign-out-button.tsx` (replacing their current inline/duplicated literals), and `mobile-nav-menu.tsx`. This is a plain data module (no JSX, no component), so it doesn't conflict with ADR 005's "`components/ui/*` stays generic, brand lives in one-off compositions above it" — it lives alongside the compositions, not inside the primitive.

### Testing

Extend `components/nav.test.tsx` with mobile-menu cases, mirroring the existing desktop ones but click-driven instead of hover-driven (mobile has no hover):

- Signed out: click the "Open menu" button, assert a "Sign in" menu item appears linking to `/sign-in`.
- Signed in: click "Open menu", assert the account name label, "Orders" (linking to `/orders`), and "Sign out" all appear.

No new E2E coverage — nav is not a checkout/cart/payment/auth-critical flow per ADR 001; mocked-session component tests are sufficient, consistent with the precedent set by the desktop account-menu tests.

Manual check in the dev server (narrow viewport via devtools device toolbar): burger opens/closes on tap, icon swaps, Escape closes it, both auth states render correctly, and the desktop cluster is confirmed hidden below 640px / the mobile trigger hidden at and above it.

**Accessibility audit:** run `accesslint:diff` (uncommitted-changes mode) against `http://localhost:3000/` before this work is committed, covering both auth states with the burger menu open — the new trigger button, its `aria-label`/`aria-expanded` state, and the panel's focus trap/Escape/return-focus behavior are exactly the kind of thing a live-DOM audit catches that RTL assertions don't. Treat any new violation as a blocker, the same bar the account-menu redesign was held to.
