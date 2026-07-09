# Save Address at Checkout

**Date:** 2026-07-09
**Status:** Draft

## Context

Checkout is auth-gated (ADR 006) and every `Order` already carries `user_id`, but the delivery address itself is only ever a per-order snapshot — `address_name`/`address_street`/`address_city`/`address_postcode` are written onto `Order` at `placeOrder` time and never persisted anywhere reusable. `AddressSchema`/`AddressInput` (`packages/core/src/order/schema.ts`) and `AddressForm` (`packages/web/app/checkout/_components/address-form.tsx`) are the only existing address-related code. There is no `Address` model, no account-area UI, and no address-book concept.

[Order History](2026-07-08-order-history-design.md) explicitly called out "saving address/payment details for reuse at checkout" as a related but out-of-scope feature. This design is that feature, scoped to a single saved address (no address book, no multiple named addresses, no management UI) per the product decision below.

## Decision

### Data model: `packages/api/prisma/schema.prisma`

Add four nullable columns directly to `User`, mirroring how `Order` already flattens address fields rather than using a join table:

```prisma
model User {
  ...
  address_name     String?
  address_street   String?
  address_city     String?
  address_postcode String?
}
```

One saved address per user, upserted in place — not a separate `Address` table. A join buys nothing here since the product decision is exactly one address per user, and this avoids a new table plus the extra query it would need on every checkout page load.

### API: `packages/api`

**`GET /account/address` (new)** — new `features/account` route + service (routes/services split per ADR 004), gated by `requireAuth`. Returns the signed-in user's saved address or `null`:

```ts
// responds with AddressDetails | null
```

Backed by `getSavedAddress(userId: string)` in a new `account.service.ts`, a plain `prisma.user.findUnique` selecting the four columns, returning `null` if any are unset (a partially-set address shouldn't happen since it's only ever written by the upsert below, but `null` is the safe read if the columns are empty).

**`POST /order` (modified)** — `PlaceOrderSchema` (`packages/core/src/order/schema.ts`) gains a required `saveAddress: boolean` field. The client always sends it explicitly (tied to the checkout checkbox state), so there's no server-side default to reason about.

`placeOrder` (`orders.service.ts`) takes a new `saveAddress: boolean` param. Inside the existing `$transaction`, if `saveAddress` is `true`, it also upserts the four columns onto `User` with the submitted `addressDetails` (overwrite semantics — the saved address always reflects the last address checked out with, while the box was checked). If `false`, the user's existing saved address (if any) is left untouched: unchecking the box means "don't update my saved address for this order," not "forget it." There is no delete/clear path — with only one address and no address-book UI, there is nothing to manage it from.

### Frontend: `packages/web`

**`lib/get-server-session.ts`**: add `fetchSavedAddress()`, following the exact pattern of the existing `getServerSession()` — a plain `fetch` to `GET /account/address` with the incoming request's `Cookie` header forwarded. Returns `AddressDetails | null`.

**`app/checkout/page.tsx`**: after the existing session gate, also calls `fetchSavedAddress()` and passes the result into `CheckoutFormPage` as a new `savedAddress` prop.

**`app/checkout/_components/checkout-form-page.tsx`**: `CheckoutFormPage` forwards `savedAddress` to `CheckoutForm`, which passes it as `useForm`'s `defaultValues` (falling back to `undefined` when `null`, same as today's unset-defaults behavior) so the four address fields prefill but stay editable.

**`app/checkout/_components/address-form.tsx` or `checkout-form-page.tsx`**: add a "Save this address for future orders" checkbox below the address fields, defaulting to checked. It's tracked as local `useState<boolean>` in `CheckoutForm` rather than folded into `AddressInput`/`AddressSchema` — it isn't an address field, doesn't need zod validation, and keeping it out of `AddressInput` avoids touching the shared core type also used by `Order.address_details`/`AddressDetails`.

**`lib/api.ts`**: `placeOrder()`'s body type gains `saveAddress: boolean`, sent alongside the existing fields to `POST /order`.

### Error handling

- `GET /account/address` for a signed-out caller → 403 via `requireAuth` (consistent with every other protected endpoint).
- No saved address yet → `200` with `null` body, not an error; checkout renders a blank form exactly as it does today.
- `saveAddress` upsert happens inside the same `$transaction` as order creation and cart deletion, so a failure there rolls back the whole order — an address save can't silently fail while the order otherwise succeeds.

## Testing

**API** (new `account.test.ts` + extended `orders.test.ts`, against real Postgres per this project's existing convention for checkout/order code):

- `GET /account/address` returns `null` for a user with none, and the saved fields for a user who has one.
- `GET /account/address` returns 403 when signed out.
- `placeOrder` with `saveAddress: true` writes the address onto `User` (verified via direct Prisma read, not just the order response).
- `placeOrder` with `saveAddress: true` on a user who already has a saved address overwrites it with the new one.
- `placeOrder` with `saveAddress: false` leaves an existing saved address unchanged.

**Web** (component tests, Vitest + RTL + MSW, `packages/web/tests/component`):

- Checkout form prefills all four fields from a mocked `GET /account/address` response.
- Checkout form renders blank when the mocked response is `null`.
- The save-address checkbox defaults to checked.
- Submitting with the checkbox unchecked sends `saveAddress: false` in the `placeOrder` request body; checked sends `true`.

**E2E** (`packages/web/tests/e2e/checkout.spec.ts`, extended): checkout is a designated critical flow (ADR 001), so this gets one added scenario — place an order with the checkbox checked, return to checkout on a second visit, and confirm the address fields are prefilled. No new spec file; extends the existing one.

## Consequences

- `User` now carries mutable, non-historical address data alongside `Order`'s immutable per-order snapshot — the two are deliberately not linked; changing a saved address never touches past orders, and placing an order never requires having a saved address.
- Scoped to exactly one address per user by product decision: no address book, no naming/labeling, no add/edit/delete management UI, no way to explicitly clear a saved address once set (only overwrite via a future checkout with the box checked). Revisit this design if multiple addresses are ever needed — it would mean a real `Address` table, not an extension of these four columns.
- `PlaceOrderSchema` changing to a required `saveAddress` field is a breaking change to `POST /order`'s request contract; the only existing caller is `packages/web`'s `placeOrder()`, updated in the same change.
