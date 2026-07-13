# My Details Page — Edit Saved Address

**Date:** 2026-07-13
**Status:** Draft

## Context

[Save Address at Checkout](2026-07-09-save-address-checkout-design.md) added `GET /account/address` and a single saved address per `User` (`addressName`/`addressStreet`/`addressCity`/`addressPostcode`), but scoped itself explicitly to _no_ management UI — the saved address is only ever written by checking "Save this address for future orders" at checkout. That design's Consequences section calls this out directly: "no add/edit/delete management UI... Revisit this design if multiple addresses are ever needed."

This design revisits that decision for the single-address case only (still no address book, still one address per user) by adding a standalone page where a signed-in customer can view and edit their saved address outside of checkout.

## Decision

### Scope: address only

"My Details" is address-only for now — no name/email/password editing. Broader account-details editing would need to reckon with Better Auth's handling of email uniqueness/verification and password changes, which is out of scope here.

### API: `packages/api`

**`PUT /account/address` (new)**, added to the existing `features/account/account.routes.ts`, gated by `requireAuth`. Request body validated with the existing `AddressSchema` (`@marketplace/core`, the same schema `PlaceOrderSchema.address_details` uses), via the inline `safeParse` + 400 pattern already used by `cart.routes.ts`/`orders.routes.ts` (no shared validation middleware exists in this codebase). On success, returns the saved `AddressDetails` (200).

Backed by a new `saveAddress(userId: string, address: AddressInput): Promise<AddressDetails>` in `account.service.ts` — a plain `prisma.user.update` writing the same four columns `getSavedAddress` reads and checkout's `placeOrder` already writes. This is a separate write path from checkout's `saveAddress: true` upsert (no shared helper) — they simply write the same columns. Always a full replace of all four fields (`AddressSchema` requires all of them), consistent with the existing PUT convention in this API (`PUT /cart/products/:productId`).

### Frontend: `packages/web`

**`app/my-details/page.tsx` (new)** — a Server Component, gated exactly like `app/orders/page.tsx`: calls `getServerSession()` and `redirect("/sign-in?redirect=/my-details")` if signed out. Fetches `fetchSavedAddress()` server-side, forwarding the incoming request's `Cookie` header (same pattern as `app/orders/page.tsx`/`app/checkout/page.tsx`), and passes the result into a new client form component.

**`app/my-details/_components/my-details-form.tsx` (new)** — Client Component. Reuses the existing `AddressForm` (register/errors) exactly as `CheckoutForm` does: `useForm<AddressInput>` with `zodResolver(AddressSchema)`, `defaultValues: savedAddress ?? undefined`. When there's no saved address yet, this naturally renders a blank form — first save and edit are the same flow, no separate empty state.

On submit, calls a new `saveAddress(body: AddressInput)` in `lib/api.ts` (`apiFetch<AddressDetails>("/account/address", { method: "PUT", body: JSON.stringify(body) })`, following the existing `apiFetch` pattern). Shows an inline "Address saved" success message near the form on success, and the same inline `role="alert"` error-message pattern `CheckoutForm` uses (`formError` state) on failure.

**`components/account-menu.tsx`** (desktop dropdown) **and `components/mobile-nav-menu.tsx`** (mobile burger menu) — both already duplicate an "Orders" item for signed-in users (the mobile menu was added after the desktop one, mirroring its items). Add a `DropdownMenuItem` to each (same `navMenuItemClassName` styling as the existing "Orders" item) linking to `/my-details`, labelled "My Details", placed above "Orders" — keeping the two menus consistent with each other.

### Error handling

- `PUT /account/address` for a signed-out caller → 403 via `requireAuth`, consistent with `GET /account/address` and every other protected endpoint.
- Invalid body (e.g. malformed postcode) → 400 with `{ error, code: "INVALID_INPUT" }`, consistent with `cart.routes.ts`/`orders.routes.ts`.
- No new error cases on the frontend beyond the existing inline error-message pattern already used by `CheckoutForm`.

## Testing

**API** (`account.test.ts`, extended, real Postgres per existing convention for this feature):

- `PUT /account/address` saves a new address for a user with none.
- `PUT /account/address` overwrites an existing saved address.
- `PUT /account/address` returns 403 when signed out.
- `PUT /account/address` returns 400 for an invalid body (e.g. bad postcode).

**Web** (component test colocated with `my-details-form.tsx`, Vitest + RTL + MSW, per ADR 001):

- Renders a blank form when the mocked `GET /account/address` returns `null`.
- Prefills all four fields when the mocked response has a saved address.
- Submitting calls `PUT /account/address` with the form values and shows the "Address saved" success message.
- Shows the inline error message when the save request fails.

**Web** (`nav.test.tsx`, extended): both the desktop hover menu and the mobile burger menu show a "My Details" item linking to `/my-details` when signed in, matching the existing assertions for "Orders" in that file.

**E2E:** none. `/my-details` isn't checkout, cart, or payment, so it doesn't meet ADR 001's bar for a critical flow.

## Consequences

- Revisits, but doesn't change, the save-address-checkout design's "no management UI" scope note — checkout's own `saveAddress: true` write path is untouched; this adds a second, independent write path to the same four `User` columns.
- Still exactly one address per user, no address book, no labeling/naming, no delete — a user can only overwrite their saved address (via this page or checkout), never explicitly clear it. Unchanged from the checkout design's existing constraint.
- `PUT /account/address` and checkout's `saveAddress: true` upsert are two separate code paths writing the same columns; a future third write path (or a product decision to unify them) should watch for drift between the two.
