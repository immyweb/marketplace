# Order History

**Date:** 2026-07-08
**Status:** Draft

## Context

`packages/api` already models everything order history needs: `Order` carries `user_id`, `created_at`, `status`, `total_price`, `currency`, and its `items`. What's missing is a way for a signed-in user to see their own past orders — there is no list endpoint, and the one existing detail endpoint, `GET /order/:id`, has no ownership check at all. ADR 006 called this out explicitly: "`GET /order/:id` has no ownership check today... acceptable for today's scope... but must be revisited before building order history." This design is that revisit.

`packages/web` has no account-area UI today. The closest existing surface is `app/order-confirmation/[id]/page.tsx`, rendered immediately after checkout, with "Order Confirmed / Thank you for your order" framing that doesn't fit a user browsing older orders.

This design covers order history only (a list view plus a neutral detail view). Saving address/payment details for reuse at checkout is a related but independent feature and is out of scope here.

## Decision

### API: `packages/api`

**`GET /order` (new)** — mounted in `orders.routes.ts`, gated by `requireAuth`. Returns the signed-in user's orders, newest first, as a summary list:

```ts
type OrderSummary = {
  id: number;
  created_at: string;
  status: string;
  total_price: number;
  currency: string;
  item_count: number;
};
// GET /order responds with OrderSummary[]
```

Backed by a new `listOrdersByUser(userId: string)` in `orders.service.ts`, using a `select`/`_count`-based Prisma query (no product joins) — deliberately not routed through the existing `formatOrder`/`orderInclude`, which fetch full item/product/address/payment detail that the list view doesn't need. No pagination: order volume for this project is small and there's no production deployment target today (consistent with the reasoning in ADR 002's Consequences); add it later if that changes.

**`GET /order/:id` (modified)** — gains `requireAuth` (matching every other protected endpoint in this codebase — a signed-out request gets the existing `ForbiddenError`, 403), then checks `order.user_id === req.userId` in the service layer. A mismatch for a signed-in user returns the existing `NotFoundError` (404), not `ForbiddenError` (403) — a 403 there would confirm to a different authenticated caller that the order ID exists, which a 404 doesn't. This closes the exact gap ADR 006 flagged and is a breaking change to that endpoint's public contract (previously ungated entirely); ADR 006 gets a short update recording that the gap is closed and how (see Consequences).

**`packages/core`**: add an `OrderSummary` type (`src/order/types.ts`) for the list shape above. No new Zod schema is needed — both endpoints are unparameterized `GET`s with nothing to validate beyond the existing `:id` int parse already in `orders.routes.ts`.

### Frontend: `packages/web`

**`app/orders/page.tsx`** (new) — Server Component, following the same auth-gate pattern as `app/checkout/page.tsx`: calls `getServerSession()` and `redirect("/sign-in?redirect=/orders")` if signed out. Fetches `GET /order` server-side with the incoming request's `Cookie` header forwarded (the same pattern `components/nav.tsx` uses for `fetchCart`). Renders each order as a row — `#123 · 3 July 2026 · 2 items · £34.00 · confirmed` — linking to `/orders/[id]`. Empty state (no orders yet): a message plus a link to `/products`.

**`app/orders/[id]/page.tsx`** (new) — same three sections as `order-confirmation/[id]` (order summary/items, delivery address, payment last-4), reusing that page's layout and styling conventions but with neutral copy (`Order #123` heading, no "Order Confirmed" banner). Since `GET /order/:id` now 403s for a signed-out caller (not 404 — see below), this page needs its own `getServerSession()` redirect gate, same as `/orders`, so a signed-out visit redirects to sign-in instead of surfacing an unhandled 403. Once signed in, it calls `fetchOrder(id)` and, on a 404 (`ApiRequestError` with `status === 404`), calls `notFound()` — same pattern as `order-confirmation/[id]`. That 404 path now covers both "order doesn't exist" and "exists but belongs to someone else."

**`lib/api.ts`**: add `fetchOrders(init?: RequestInit)` returning `OrderSummary[]`, mirroring the existing `fetchCart`. Also change `fetchOrder(id: number)` to `fetchOrder(id: number, init?: RequestInit)`, forwarding `init` through to `apiFetch` — today it forwards no cookies at all, which was fine while `GET /order/:id` was ungated, but once it requires auth, the existing `app/order-confirmation/[id]/page.tsx` (a Server Component, called right after a real checkout) would start getting 403s for the user's own order unless it forwards the session cookie. `order-confirmation/[id]/page.tsx` is updated to call `headers()` and pass the `Cookie` header through, the same way `app/orders/[id]/page.tsx` and `components/nav.tsx` already do.

**`components/nav.tsx`**: add an "Orders" link inside the existing `session ? (...)` branch, alongside the user's name and `SignOutButton` — only rendered when signed in.

### Error handling

- Signed-out access to `/orders` or `/orders/[id]` → redirected to sign-in at the page level, both via a `getServerSession()` gate (same pattern as `app/checkout/page.tsx`).
- Direct API calls to `GET /order` or `GET /order/:id` without auth → 403 via the existing `requireAuth` middleware (unchanged behavior for the existing endpoint; newly applied to both).
- Direct API calls to `GET /order/:id` for another signed-in user's order → 404, not 403, to avoid confirming order existence to a caller who doesn't own it.
- An empty order history is not an error — it's a normal empty state in the UI.

## Testing

**API** (`orders.test.ts`, extended) — this project tests checkout/order code against real Postgres and real Stripe test-mode API calls (no mocks), and this extends that same suite:

- `GET /order` returns only the signed-in caller's orders, newest first, with correct summary fields (including `item_count`) — verified with a second user's orders present in the DB to confirm no cross-user leakage.
- `GET /order/:id` still returns the full order for its owner (existing behavior, now behind auth).
- `GET /order/:id` returns 404 for another signed-in user's order.
- `GET /order/:id` returns 403 when signed out (replacing the old ungated-access assumption — existing tests for this endpoint that call it without signing in need updating).

**Web** (component tests, Vitest + RTL + MSW, `packages/web/tests/component`):

- `/orders`: empty state, populated list state, and the sign-in redirect when signed out.
- `/orders/[id]`: renders order detail; 404s (via `notFound()`) when the API returns 404; redirects to sign-in when signed out.
- `nav.test.tsx`: extended to assert the "Orders" link appears only when signed in.
- `order-confirmation-page.test.tsx`: needs a `next/headers` mock added (the page now calls `headers()` to forward the session cookie, which it didn't before) — existing assertions are otherwise unaffected.

No new E2E coverage — order history isn't a checkout/cart/payment critical flow, so component tests are sufficient per [ADR 001](../adr/001-testing-setup.md).

## Consequences

- `GET /order/:id`'s public contract changes: it was previously reachable by anyone with an order ID, and is now `requireAuth` + ownership-checked. `order-confirmation/[id]` is the only existing caller; it only ever runs for the user who just placed the order, but it must start forwarding the session cookie (see Frontend section) or it would break. [ADR 006](../adr/006-authentication.md) needs a short update recording that this gap is now closed, referencing this spec.
- The order list query intentionally does not reuse `formatOrder`/`orderInclude` — introducing a second, lighter Prisma query shape for `Order` alongside the existing full-detail one. This is a deliberate split (list vs. detail have different data needs), not duplication to reconcile.
- No pagination now means a user with a very large order history gets one long list; acceptable at this project's current scale, called out explicitly rather than silently deferred.
- Saved address/payment-for-reuse-at-checkout remains fully out of scope — this design only adds read access to orders that already exist.
