# API Routes → Services Refactor

## Problem

`packages/api/src/routes/*.ts` mixes HTTP concerns (parsing `req.body`/`req.params`, status codes, session access) with business logic (Prisma queries, Stripe calls, cart total math, response formatting). `orders.ts` duplicates the same order-response-shaping code between its POST and GET handlers. `checkout.ts` and `orders.ts` each construct their own Stripe client. There's no dedicated place for business logic, making routes hard to read and logic hard to reuse or unit test independently of HTTP.

## Goals

- Move business logic (DB access, Stripe calls, calculations, response formatting) out of `routes/` into a new `services/` folder.
- Keep routes thin: parse input, call one service function, shape the HTTP response.
- Preserve exact existing behavior — response bodies, status codes, and error `code` values must stay byte-identical, since the existing supertest suite in `packages/api/tests/*.test.ts` asserts on them and must keep passing unmodified.
- Fix small, directly-related duplication encountered along the way (duplicated order formatting, duplicated Stripe client construction) — no unrelated cleanup.

## Non-Goals

- No change to route paths, request/response shapes, or status codes.
- No change to test files.
- No class-based service objects — plain exported functions, consistent with the rest of the codebase (route handlers, `db/prisma.ts`).
- No move of input validation (Zod parsing, `parseInt`) into services — stays in routes.

## Design

### File layout

```
packages/api/src/
  errors.ts                 # AppError, NotFoundError, ForbiddenError, PaymentFailedError
  services/
    cart.service.ts
    checkout.service.ts
    orders.service.ts
    products.service.ts
    stripe.ts                # shared Stripe client
  routes/                    # unchanged filenames, slimmed down
```

### Error handling

`src/errors.ts` defines:

```ts
class AppError extends Error {
  constructor(message: string, public statusCode: number, public code: string)
}
class NotFoundError extends AppError    // 404, "NOT_FOUND"
class ForbiddenError extends AppError   // 403, "FORBIDDEN"
class PaymentFailedError extends AppError // code "PAYMENT_FAILED", statusCode defaults to 400, overridable to 500
```

`middleware/error.ts` gains one branch before the existing fallback:

```ts
if (err instanceof AppError) {
  res.status(err.statusCode).json({ error: err.message, code: err.code });
  return;
}
```

Routes keep their existing `try { ... } catch (err) { next(err); return; }` wrapping — a thrown `AppError` from a service now flows through to the correct HTTP response with no extra branching needed in the route itself.

### Split of responsibilities

**Stays in routes:**

- Zod schema parsing and `parseInt` param parsing, with their existing 400 responses.
- The cart-ownership session check (`cartId !== req.session.cartId` in `checkout.ts` and `orders.ts`) — this is a pure comparison against `req.session`, no DB access, so it stays in the route as `if (...) throw new ForbiddenError(...)`.
- Setting/clearing `req.session.cartId`.
- Calling exactly one service function per handler and sending the response.

**Moves to services:**

- All Prisma queries.
- All Stripe calls.
- Cart total / order total calculations.
- Response formatting (`formatCart`, `formatOrder`).

### Per-service breakdown

**`cart.service.ts`**

- Moves in `formatCart` and `cartInclude` (private, not exported — confirmed unused outside `cart.ts` today).
- `findCartById(cartId: number): Promise<CartDTO | null>` — returns `null` if not found (not an error: `GET /cart` uses this to detect a stale session cartId and clear it, which is session cleanup handled in the route, not a business error).
- `createCart(sessionId: string): Promise<{ id: number }>`
- `addProductToCart(cartId: number | null, sessionId: string, productId: number, quantity: number): Promise<{ cartId: number; cart: CartDTO }>` — throws `NotFoundError` if the product doesn't exist; creates a cart if `cartId` is `null`.
- `updateCartItemQuantity(cartId: number | null, productId: number, quantity: number): Promise<CartDTO>` — throws `NotFoundError` ("Cart not found" / "Item not in cart") matching current messages.
- `removeCartItem(cartId: number | null, productId: number): Promise<CartDTO>` — throws `NotFoundError` if `cartId` is `null`.

**`checkout.service.ts`**

- `createPaymentIntent(cartId: number): Promise<{ clientSecret: string; amount: number }>` — throws `NotFoundError` if cart missing/empty; throws a plain `Error` (unchanged) if Stripe doesn't return a `client_secret`, preserving today's generic-500 behavior.

**`orders.service.ts`**

- Private `formatOrder` used by both functions below (removes today's copy-paste between the POST and GET handlers).
- `placeOrder(params: { cartId: number; paymentIntentId: string; addressDetails: {...} }): Promise<OrderDTO>` — retrieves and validates the Stripe PaymentIntent (`PaymentFailedError`, 400, for invalid intent or non-`succeeded` status), loads the cart (`NotFoundError` if missing/empty), extracts card last-four (keeps the existing `console.error` ALERT log and throws `PaymentFailedError` with `statusCode: 500` if unreadable), then creates the order and deletes the cart in one `prisma.$transaction`, matching current behavior exactly.
- `getOrderById(id: number): Promise<OrderDTO>` — throws `NotFoundError` if not found.

**`products.service.ts`**

- `listProducts(): Promise<ProductDTO[]>`
- `getProductById(id: number): Promise<ProductDTO>` — throws `NotFoundError`.

**`services/stripe.ts`**

- One shared `export const stripe = new Stripe(...)` instance, replacing the two separate instantiations currently in `checkout.ts` and `orders.ts`.

## Testing

No test files change. After the refactor, run the existing api test suite (`packages/api/tests/*.test.ts` via `bun test` or the package's configured test script) and confirm all cases still pass unmodified — this is the acceptance check for the whole refactor, since those tests assert on exact response bodies and status codes.

## Open Questions

None — design approved by user as presented.
