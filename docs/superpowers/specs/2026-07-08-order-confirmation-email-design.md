# Order Confirmation Email

**Date:** 2026-07-08
**Status:** Draft

## Context

`packages/api`'s `placeOrder` (`src/features/orders/orders.service.ts`) verifies a Stripe `PaymentIntent`, creates the `Order` + `OrderItem` rows and deletes the cart in one transaction, and returns the order to the customer. There is no email-sending infrastructure anywhere in the codebase — no provider dependency, no shared client, no template. `User.email` (Better Auth's `User` model) is the only piece of customer contact data available, and `Order.user_id` already links every order to its user, but `orders.service.ts`'s `orderInclude` does not currently pull in the `user` relation.

The goal is: once an order is successfully placed, the customer receives an email confirming it, without adding new blocking infrastructure (a job queue) or risking the checkout response on a third-party API call.

## Decision

### Provider and dependencies

Use [Resend](https://resend.com) as the email provider and `react-email` (the unified package as of React Email 6.0 — components, `render`, and `toPlainText` are all exported from `react-email` itself, not the older split `@react-email/components`/`@react-email/render` packages) to build the template.

Add to `packages/api/package.json`: `resend`, `react-email`, `react`, `react-dom`. `packages/api` has no prior React dependency (it's a pure Express backend) — these are added purely for server-side rendering of one email template; nothing ships to a browser and there is no bundler-size concern.

### New modules

- **`src/shared/email.ts`** — exports a configured `resend` singleton:

  ```ts
  import { Resend } from "resend";

  export const resend = new Resend(process.env.RESEND_API_KEY!);
  ```

  This mirrors the existing `src/shared/stripe.ts` pattern (a single shared client instance for a third-party API).

- **`src/features/orders/order-confirmation.email.tsx`** — colocated with the orders feature (like `orders.service.ts`, `orders.routes.ts`):
  - `OrderConfirmationEmail`, a `react-email` component rendering order number, line items (name/quantity/price), total, shipping address, and card last-4, styled with simple inline styles loosely echoing the Field Ledger palette (ADR 007) — e.g. the existing brand hex values for text/accent colors, and a monospace font for the order number/prices/total, matching the site's "recorded figures render in mono" convention. No stamp motif, dashed-stitch dividers, or ledger line-numbering — those are reserved for a fuller on-brand treatment this design deliberately doesn't take on (see Consequences).
  - `sendOrderConfirmationEmail(order: OrderDTO, toEmail: string, toName: string): Promise<void>` — calls `resend.emails.send(...)` with `from` set to `EMAIL_FROM`, `to` set to `toEmail`, a subject of the form `Order Confirmation — #<order id>`, and `react` set to a rendered `<OrderConfirmationEmail>`. Resend's SDK returns `{ data, error }` rather than throwing on send failure; this function checks `error` and logs via the shared Pino logger (`logger.warn({ orderId: order.id, error }, "Failed to send order confirmation email")`) — no customer email/address in the log payload. The call is also wrapped so any unexpected throw (e.g. a network-level failure before Resend's SDK returns) is caught the same way. This function never throws.

### Wiring into `placeOrder`

- `orderInclude` gains `user: { select: { email: true, name: true } }` — the order query already fetches everything the email needs, no extra DB round-trip.
- After the `$transaction` that creates the order and deletes the cart commits, `placeOrder` calls `await sendOrderConfirmationEmail(order, order.user.email, order.user.name)`. Because the function never throws, this can't fail the request; the checkout response still waits for the send attempt to finish (or fail) before returning, keeping the code path synchronous and simple (no background job runner introduced).
- `orders.routes.ts` is unchanged — this stays entirely inside the service, consistent with ADR 004's routes-thin/services-hold-logic split.

### Configuration

Two new env vars in `packages/api/.env` and `.env.test`:

- `RESEND_API_KEY`
- `EMAIL_FROM` — set to Resend's sandbox address (`onboarding@resend.dev`) for now; swappable later to a verified domain address without any code change once one exists.

## Testing

`packages/api` gets a new `msw` devDependency. `orders.test.ts` uses `msw/node`'s `setupServer` to intercept `POST https://api.resend.com/emails`, extending the network-mocking exception to ADR 001's no-mocking rule that already exists for the web package's component tests (MSW-mocked network calls), rather than introducing a second, different mocking mechanism (e.g. `vi.mock`).

Two behaviors are covered in the `POST /order` test suite:

1. The existing happy-path test (order placed, `201`, cart cleared) continues to pass with the intercepted Resend call returning a success response — proving the send is wired in without changing existing response assertions.
2. A new test: placing an order still returns `201` and creates the order when the intercepted Resend call returns an error response — proving the "never fail the order" guarantee holds.

No test asserts on the rendered email's HTML content — the template is simple enough (a handful of interpolated fields, no conditional branches beyond what `OrderDTO` already guarantees) that a snapshot or DOM assertion would be testing `react-email`'s renderer, not this codebase's logic.

## Consequences

- A failed email send is only ever visible via a `warn`-level log line — there is no retry mechanism. This is an accepted gap for this project's scale, not an oversight; introducing a job queue (e.g. BullMQ + Redis) purely for retry-able email delivery was considered and rejected as disproportionate new infrastructure with no other use case in this codebase yet.
- Checkout latency now includes a synchronous Resend API call (typically sub-second). If this becomes a measured problem, the fix is a queue — not swapping to a fire-and-forget unawaited call, since this is a long-running Bun/Express server (ADR 003) where an unawaited promise would still run to completion, but its errors would only surface asynchronously and be harder to reason about than the current awaited-but-non-throwing shape.
- ADR 001 (testing) documents exactly one exception to "no mocking, test against real dependencies": MSW for network calls in web component tests. This design introduces a second: MSW for the Resend network call in `packages/api`'s test suite. This ADR should be updated to record both exceptions together, rather than the second one accumulating undocumented next to the first.
- The email template is intentionally a lighter treatment than the full Field Ledger visual language (no stamp, no ledger numbering) — a deliberate scope decision for this design, not an oversight to reconcile later, since ADR 007 already treats these motifs as hand-applied per-surface rather than a shared component contract that a new surface is obligated to pick up.
