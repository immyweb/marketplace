# Top Nav Redesign

**Date:** 2026-07-09
**Status:** Draft

## Context

`components/nav.tsx` renders the site header. Today, when signed in, it shows the user's name, an "Orders" link, and a "Sign out" button all inline in a `gap-3` row, next to a `gap-6`-separated "Cart" link. When signed out, it shows a plain "Sign in" link next to "Cart". The user-facing complaint: the links sit too close together with no visual separation between the account area and Cart.

This design consolidates the signed-in account links into a hover/tap dropdown off the user's name, and adds a visual divider between the account cluster and Cart in both states. The codebase already has a Radix-based `DropdownMenu` primitive (`components/ui/dropdown-menu.tsx`), used click-triggered in `app/products/_components/sort-select.tsx` — this design builds on that primitive rather than hand-rolling a new one.

## Decision

### Signed-in state

`[ Name ▾ ]  │  Cart 2`

- The user's name becomes a `DropdownMenu` trigger (name text + a small `ChevronDownIcon`, matching the chevron convention in `SortSelect`), replacing the inline "Orders" link and `SignOutButton`.
- Dropdown content: **Orders** (link to `/orders`) then a `DropdownMenuSeparator` then **Sign out** (existing `SignOutButton` logic, restyled as a `DropdownMenuItem` instead of an inline text button).
- Open behavior is controlled (`open`/`onOpenChange` state on `DropdownMenu`, not the uncontrolled default):
  - `onMouseEnter` on the trigger wrapper → open.
  - `onMouseLeave` on the trigger wrapper → close after a ~150ms delay (avoids flicker when moving the pointer from the name into the dropdown content).
  - Radix's own click/keyboard toggle (Enter/Space on the focused trigger) flows through the same controlled `onOpenChange`, so it still opens/closes the menu — this is what makes it usable by touch (tap) and keyboard, without any device-detection logic.
  - Escape-to-close and outside-click-to-close are Radix defaults, unchanged.

### Signed-out state

`[ Sign in ]  │  Cart 2`

- "Sign in" stays a plain `Link`, unchanged styling (`font-mono text-sm tracking-wide uppercase hover:text-accent`) — not converted to a `Button`.

### Visual separation

- A vertical divider (`border-l border-primary-foreground/30`, with left padding on the following element) sits between the account cluster (name-dropdown or sign-in link) and the Cart link, in both signed-in and signed-out states.
- Outer gap between the two clusters increases slightly (from `gap-6`) to give the divider room to read as a deliberate separator rather than a stray line.

### Testing

- `tests/component/nav.test.tsx`, updated:
  - Signed-out test: unchanged assertions (still asserts a "Sign in" link, still asserts no "Orders" link/"Sign out" button present).
  - Signed-in test: since "Orders" and "Sign out" now live inside the dropdown instead of being rendered inline, the test opens the dropdown first (fires a hover or click on the name trigger via Testing Library) before asserting the "Orders" link and "Sign out" button are present.
- No new E2E coverage — nav is not a checkout/cart/payment/auth-critical flow per ADR 001, and existing component-test coverage (mocked session via MSW) is sufficient.
- Manual check in the dev server: hover-open on desktop for both states, and divider rendering, before calling this done.
