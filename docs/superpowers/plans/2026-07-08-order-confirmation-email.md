# Order Confirmation Email Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** After a customer places an order, send them a confirmation email via Resend, without ever failing the checkout request if the send fails.

**Architecture:** A shared `resend` client (`packages/api/src/shared/email.ts`, mirroring the existing `shared/stripe.ts` pattern) is used by a new `sendOrderConfirmationEmail` function colocated with the orders feature. It renders a `react-email` template and calls `resend.emails.send`, catching/logging any failure internally so it never throws. `orders.service.ts`'s `placeOrder` calls it, awaited, after its existing transaction commits — nothing else in the request pipeline changes. Tests intercept the Resend network call with `msw/node`, a second exception to this project's "no mocks" testing rule (ADR 001), alongside the one already in place for the web package.

**Tech Stack:** Resend Node SDK, `react-email` (unified package, v6+), Vitest + Supertest (existing), MSW (`msw/node`, new to `packages/api`).

**Design doc:** `docs/superpowers/specs/2026-07-08-order-confirmation-email-design.md`

## Global Constraints

- Provider is Resend; template library is `react-email` — import components, `render`, and `toPlainText` from the single `react-email` package, not `@react-email/components` or `@react-email/render` (those were folded into `react-email` as of v6.0).
- Sender address is `EMAIL_FROM=onboarding@resend.dev` (Resend's sandbox address) — an env var, not hardcoded, so it can be swapped later without a code change.
- The email send is **awaited** by `placeOrder` but must **never throw** — any Resend-reported error or unexpected exception is caught internally and logged at `warn` via the shared Pino logger (`@/shared/logger`), and the checkout request must still succeed.
- No customer email address or shipping address is ever included in a log payload.
- New `packages/api` dependencies: `resend`, `react`, `react-dom`, `react-email` (`dependencies`); `msw` (`devDependency`).
- New env vars in `packages/api/.env` and `.env.test`: `RESEND_API_KEY`, `EMAIL_FROM`.
- No test asserts on the rendered email's HTML content — only that `sendOrderConfirmationEmail`/the Resend call happens, and that its failure doesn't affect the checkout response.
- Cross-directory imports use the `@/*` alias (e.g. `@/shared/email`); same-directory imports stay relative — per ADR 004.

---

### Task 1: Dependencies, config, and the shared Resend client

**Files:**

- Modify: `packages/api/package.json`
- Modify: `packages/api/tsconfig.json`
- Modify: `packages/api/.env`
- Modify: `packages/api/.env.test`
- Create: `packages/api/src/shared/email.ts`

**Interfaces:**

- Produces: `resend` (a configured `Resend` client instance), exported from `@/shared/email`, consumed by Task 3.

- [ ] **Step 1: Add dependencies to `packages/api/package.json`**

  In `"dependencies"`, add (keeping alphabetical order with the existing entries):

  ```json
    "react": "^19.2.7",
    "react-dom": "^19.2.7",
    "react-email": "^6.6.8",
    "resend": "^6.17.1",
  ```

  In `"devDependencies"`, add:

  ```json
    "msw": "^2.14.6",
  ```

  The full `dependencies` block should read:

  ```json
  "dependencies": {
    "@marketplace/core": "*",
    "@prisma/adapter-pg": "^7.0.0",
    "@prisma/client": "^7.0.0",
    "better-auth": "^1.6.23",
    "connect-pg-simple": "^10.0.0",
    "pg": "^8.0.0",
    "cors": "^2.8.5",
    "dotenv": "^17.0.0",
    "express": "^5.0.0",
    "express-session": "^1.18.0",
    "pino": "^10.3.1",
    "pino-http": "^11.0.0",
    "react": "^19.2.7",
    "react-dom": "^19.2.7",
    "react-email": "^6.6.8",
    "resend": "^6.17.1",
    "stripe": "^22.3.0",
    "zod": "^3.23.0"
  },
  ```

  And `devDependencies`:

  ```json
  "devDependencies": {
    "@types/connect-pg-simple": "^7.0.0",
    "@types/cors": "^2.8.0",
    "@types/express": "^5.0.0",
    "@types/express-serve-static-core": "^5.0.0",
    "@types/express-session": "^1.18.0",
    "@types/node": "^22.0.0",
    "@types/pg": "^8.0.0",
    "@types/supertest": "^7.0.0",
    "msw": "^2.14.6",
    "pino-pretty": "^13.1.3",
    "prisma": "^7.0.0",
    "supertest": "^7.0.0",
    "tsc-alias": "^1.9.0",
    "typescript": "^6.0.3",
    "vitest": "^4.1.9"
  }
  ```

- [ ] **Step 2: Enable JSX in `packages/api/tsconfig.json`**

  `packages/api` has never had a `.tsx` file before — add `"jsx": "react-jsx"` to `compilerOptions`:

  ```json
  {
    "compilerOptions": {
      "target": "ES2022",
      "module": "CommonJS",
      "lib": ["ES2022"],
      "outDir": "dist",
      "rootDir": ".",
      "strict": true,
      "esModuleInterop": true,
      "skipLibCheck": true,
      "resolveJsonModule": true,
      "jsx": "react-jsx",
      "paths": {
        "@/*": ["./src/*"]
      }
    },
    "include": ["src", "prisma", "tests", "index.ts"],
    "exclude": ["node_modules", "dist"]
  }
  ```

- [ ] **Step 3: Add env vars to `packages/api/.env`**

  Append:

  ```
  # Resend (https://resend.com) — replace with a real key before sending live email;
  # tests never hit the network (see tests/resend-mock.ts) so a placeholder works for local dev too.
  RESEND_API_KEY=re_placeholder_replace_me
  EMAIL_FROM=onboarding@resend.dev
  ```

- [ ] **Step 4: Add env vars to `packages/api/.env.test`**

  Append:

  ```
  RESEND_API_KEY=re_test_dummy_key
  EMAIL_FROM=onboarding@resend.dev
  ```

- [ ] **Step 5: Install dependencies**

  Run from the repo root: `bun install`
  Expected: completes with no errors; `packages/api/node_modules` now contains `resend`, `react`, `react-dom`, `react-email`, `msw`.

- [ ] **Step 6: Create the shared Resend client**

  Create `packages/api/src/shared/email.ts`:

  ```ts
  import { Resend } from "resend";

  export const resend = new Resend(process.env.RESEND_API_KEY!);
  ```

- [ ] **Step 7: Verify it type-checks**

  Run: `cd packages/api && bunx tsc --noEmit`
  Expected: no errors (mirrors the existing `shared/stripe.ts`/`shared/logger.ts` files, which also have no dedicated test — this is a three-line client construction with no conditional logic worth unit-testing in isolation).

- [ ] **Step 8: Commit**

  ```bash
  git add packages/api/package.json packages/api/tsconfig.json packages/api/.env packages/api/.env.test packages/api/src/shared/email.ts bun.lock
  git commit -m "$(cat <<'EOF'
  Add Resend dependency and shared client for order confirmation email

  Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
  EOF
  )"
  ```

  (If the lockfile has a different name in this repo, e.g. `bun.lockb`, adjust the `git add` accordingly — check `git status` first.)

---

### Task 2: MSW test harness for the Resend network call

**Files:**

- Create: `packages/api/tests/resend-mock.ts`
- Modify: `packages/api/tests/setup.ts`
- Create: `packages/api/src/shared/email.test.ts`

**Interfaces:**

- Consumes: `resend` from `@/shared/email` (Task 1).
- Produces: `resendHandlers` (default MSW handler array) from `./resend-mock`, and `server` (the running MSW `SetupServerApi` instance) exported from `tests/setup.ts` — both consumed by Task 3's tests, which use `server.use(...)` to override the default success handler per-test.

- [ ] **Step 1: Write the failing test**

  Create `packages/api/src/shared/email.test.ts`:

  ```ts
  import { describe, it, expect } from "vitest";
  import { http, HttpResponse } from "msw";
  import { resend } from "./email";
  import { server } from "../../tests/setup";

  describe("resend client (MSW harness)", () => {
    it("returns the mocked success response for a send call", async () => {
      const { data, error } = await resend.emails.send({
        from: "test@example.com",
        to: "delivered@resend.dev",
        subject: "hello",
        html: "<p>hi</p>",
      });

      expect(error).toBeNull();
      expect(data).toMatchObject({ id: expect.any(String) });
    });

    it("returns the mocked error response when Resend reports a failure", async () => {
      server.use(
        http.post("https://api.resend.com/emails", () => {
          return HttpResponse.json(
            { message: "Invalid `to` field", name: "validation_error" },
            { status: 422 },
          );
        }),
      );

      const { data, error } = await resend.emails.send({
        from: "test@example.com",
        to: "not-an-email",
        subject: "hello",
        html: "<p>hi</p>",
      });

      expect(data).toBeNull();
      expect(error).toMatchObject({ name: "validation_error" });
    });
  });
  ```

- [ ] **Step 2: Run it to verify it fails**

  Run: `cd packages/api && bun run test -- email.test.ts`
  Expected: FAIL — `tests/setup.ts` has no exported member `server` yet (TypeScript/import error), so the test file can't even run.

- [ ] **Step 3: Create the default Resend MSW handlers**

  Create `packages/api/tests/resend-mock.ts`:

  ```ts
  import { http, HttpResponse } from "msw";

  export const resendHandlers = [
    http.post("https://api.resend.com/emails", () => {
      return HttpResponse.json({ id: "email_test_id" });
    }),
  ];
  ```

- [ ] **Step 4: Wire MSW into `tests/setup.ts`**

  Replace the full contents of `packages/api/tests/setup.ts` with:

  ```ts
  import { afterAll, afterEach, beforeAll } from "vitest";
  import { setupServer } from "msw/node";
  import { prisma } from "@/shared/db/prisma";
  import { resendHandlers } from "./resend-mock";

  export const server = setupServer(...resendHandlers);

  beforeAll(async () => {
    process.env.DATABASE_URL =
      "postgresql://marketplace:marketplace@localhost:5433/marketplace_test";
    await prisma.$connect();
    server.listen({ onUnhandledRequest: "bypass" });
  });

  afterEach(() => {
    server.resetHandlers();
  });

  afterAll(async () => {
    await prisma.$disconnect();
    server.close();
  });
  ```

  `onUnhandledRequest: "bypass"` (not `"error"`, unlike the web package's stricter component-test setup) is deliberate: `packages/api`'s tests also make real network calls to Stripe's test-mode API, which must keep passing through untouched — MSW here only needs to intercept the one Resend endpoint.

- [ ] **Step 5: Run the tests again to verify they pass**

  Run: `cd packages/api && bun run test -- email.test.ts`
  Expected: PASS — both `resend client (MSW harness)` tests green.

- [ ] **Step 6: Run the full API test suite to check for regressions**

  Run: `cd packages/api && bun run test`
  Expected: PASS — all existing tests (products, cart, checkout, orders) still pass unaffected by the new MSW server.

- [ ] **Step 7: Commit**

  ```bash
  git add packages/api/tests/resend-mock.ts packages/api/tests/setup.ts packages/api/src/shared/email.test.ts
  git commit -m "$(cat <<'EOF'
  Add MSW harness to intercept Resend calls in API tests

  Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
  EOF
  )"
  ```

---

### Task 3: Order confirmation email template, send function, and wiring into `placeOrder`

**Files:**

- Create: `packages/api/src/features/orders/order-confirmation.email.tsx`
- Modify: `packages/api/src/features/orders/orders.service.ts`
- Modify: `packages/api/src/features/orders/orders.test.ts`

**Interfaces:**

- Consumes: `resend` from `@/shared/email` (Task 1), `logger` from `@/shared/logger`, `OrderDTO` (type already exported from `orders.service.ts`), `server`/`resendHandlers` from the test harness (Task 2).
- Produces: `OrderConfirmationEmail` (React component, props `{ order: OrderDTO; customerName: string }`) and `sendOrderConfirmationEmail(order: OrderDTO, toEmail: string, toName: string): Promise<void>`, both exported from `./order-confirmation.email` — consumed by `placeOrder` in this same task (no later task depends on them).

- [ ] **Step 1: Write the failing tests**

  In `packages/api/src/features/orders/orders.test.ts`, add these imports alongside the existing ones at the top of the file:

  ```ts
  import { http, HttpResponse } from "msw";
  import { server } from "../../../tests/setup";
  ```

  Then add these two tests inside the existing `describe("POST /order", ...)` block, after the `"creates an order from a confirmed payment intent..."` test:

  ```ts
  it("sends an order confirmation email to the signed-in user", async () => {
    let capturedRequest: { to: string; subject: string } | null = null;
    server.use(
      http.post("https://api.resend.com/emails", async ({ request }) => {
        capturedRequest = (await request.json()) as {
          to: string;
          subject: string;
        };
        return HttpResponse.json({ id: "email_test_id" });
      }),
    );

    const ag = agent(app);
    await ag.post("/cart/products").send({ productId, quantity: 1 });
    const cartRes = await ag.get("/cart");
    const cartId = cartRes.body.id;
    await signUpAgent(ag);

    const pi = await createConfirmedPaymentIntent(15);

    const res = await ag
      .post("/order")
      .send({
        cartId,
        paymentIntentId: pi.id,
        address_details: {
          name: "Jane Smith",
          street: "10 Downing Street",
          city: "London",
          postcode: "SW1A 2AA",
        },
      })
      .expect(201);

    expect(capturedRequest).toMatchObject({
      to: "jane@example.com",
      subject: `Order Confirmation — #${res.body.id}`,
    });
  });

  it("still creates the order and returns 201 when the confirmation email fails to send", async () => {
    server.use(
      http.post("https://api.resend.com/emails", () => {
        return HttpResponse.json(
          { message: "rate limit exceeded", name: "rate_limit_exceeded" },
          { status: 429 },
        );
      }),
    );

    const ag = agent(app);
    await ag.post("/cart/products").send({ productId, quantity: 1 });
    const cartRes = await ag.get("/cart");
    const cartId = cartRes.body.id;
    await signUpAgent(ag);

    const pi = await createConfirmedPaymentIntent(15);

    const res = await ag
      .post("/order")
      .send({
        cartId,
        paymentIntentId: pi.id,
        address_details: {
          name: "Jane Smith",
          street: "10 Downing Street",
          city: "London",
          postcode: "SW1A 2AA",
        },
      })
      .expect(201);

    expect(res.body.total_price).toBe(15);
  });
  ```

- [ ] **Step 2: Run the tests to verify the new "sends a confirmation email" test fails**

  Run: `cd packages/api && bun run test -- orders.test.ts`
  Expected: the `"sends an order confirmation email to the signed-in user"` test FAILS (`capturedRequest` stays `null` — nothing calls Resend yet). The `"still creates the order..."` test passes already (there's no email code path yet to fail) — this is expected and will remain valid as a regression guard once the feature exists. All pre-existing tests in this file still pass.

- [ ] **Step 3: Create the email template and send function**

  Create `packages/api/src/features/orders/order-confirmation.email.tsx`:

  ```tsx
  import {
    Body,
    Column,
    Container,
    Head,
    Heading,
    Hr,
    Html,
    Preview,
    Row,
    Section,
    Text,
  } from "react-email";
  import { resend } from "@/shared/email";
  import { logger } from "@/shared/logger";
  import type { OrderDTO } from "./orders.service";

  // Loosely echoes the Field Ledger palette (docs/adr/007-visual-identity.md)
  // without the fuller stamp/ledger-numbering treatment — a deliberate,
  // lighter-weight tier for this email (see design doc's Consequences).
  const COLORS = {
    background: "#ede6d6",
    foreground: "#26231f",
    secondary: "#7a4b2e",
  };

  const MONO_FONT = "'IBM Plex Mono', 'Courier New', monospace";

  export function OrderConfirmationEmail({
    order,
    customerName,
  }: {
    order: OrderDTO;
    customerName: string;
  }) {
    return (
      <Html lang="en">
        <Head />
        <Preview>
          Order #{order.id} confirmed — thank you for your order
        </Preview>
        <Body
          style={{
            backgroundColor: COLORS.background,
            color: COLORS.foreground,
            fontFamily: "'Public Sans', Arial, sans-serif",
          }}
        >
          <Container
            style={{
              maxWidth: "480px",
              margin: "0 auto",
              padding: "32px 24px",
            }}
          >
            <Heading style={{ fontSize: "20px", margin: "0 0 8px" }}>
              Order Confirmed
            </Heading>
            <Text style={{ margin: "0 0 16px" }}>
              Hi {customerName}, thanks for your order.
            </Text>
            <Text
              style={{
                fontFamily: MONO_FONT,
                color: COLORS.secondary,
                margin: "0 0 16px",
              }}
            >
              Order #{order.id}
            </Text>
            <Hr />
            {order.items.map((item, index) => (
              <Row key={index}>
                <Column>
                  <Text style={{ margin: "8px 0 0" }}>{item.product.name}</Text>
                  <Text
                    style={{
                      fontFamily: MONO_FONT,
                      fontSize: "13px",
                      margin: "0 0 8px",
                    }}
                  >
                    Qty {item.quantity} × {item.currency}{" "}
                    {item.price.toFixed(2)}
                  </Text>
                </Column>
              </Row>
            ))}
            <Hr />
            <Text
              style={{
                fontFamily: MONO_FONT,
                fontWeight: "bold",
                margin: "16px 0",
              }}
            >
              Total: {order.currency} {order.total_price.toFixed(2)}
            </Text>
            <Hr />
            <Section>
              <Text style={{ fontWeight: "bold", margin: "16px 0 4px" }}>
                Shipping to
              </Text>
              <Text style={{ margin: "0 0 16px" }}>
                {order.address_details.name}
                <br />
                {order.address_details.street}
                <br />
                {order.address_details.city} {order.address_details.postcode}
              </Text>
            </Section>
            <Text
              style={{
                fontFamily: MONO_FONT,
                fontSize: "12px",
                color: COLORS.secondary,
              }}
            >
              Card ending in {order.payment_details.card_last_four_digits}
            </Text>
          </Container>
        </Body>
      </Html>
    );
  }

  const EMAIL_FROM = process.env.EMAIL_FROM!;

  export async function sendOrderConfirmationEmail(
    order: OrderDTO,
    toEmail: string,
    toName: string,
  ): Promise<void> {
    try {
      const { error } = await resend.emails.send({
        from: EMAIL_FROM,
        to: toEmail,
        subject: `Order Confirmation — #${order.id}`,
        react: <OrderConfirmationEmail order={order} customerName={toName} />,
      });

      if (error) {
        logger.warn(
          { orderId: order.id, error },
          "Failed to send order confirmation email",
        );
      }
    } catch (err) {
      logger.warn(
        { orderId: order.id, err },
        "Failed to send order confirmation email",
      );
    }
  }
  ```

- [ ] **Step 4: Wire it into `placeOrder`**

  In `packages/api/src/features/orders/orders.service.ts`:

  Add the import (alongside the existing imports):

  ```ts
  import { sendOrderConfirmationEmail } from "./order-confirmation.email";
  ```

  Change the `OrderWithItems` type and `orderInclude` to include the user's email/name:

  ```ts
  type OrderWithItems = Prisma.OrderGetPayload<{
    include: {
      items: { include: { product: true } };
      user: { select: { email: true; name: true } };
    };
  }>;

  const orderInclude = {
    items: { include: { product: true } },
    user: { select: { email: true, name: true } },
  } satisfies Prisma.OrderInclude;
  ```

  Change the end of `placeOrder` from:

  ```ts
  const order = await prisma.$transaction(async (tx) => {
    const created = await tx.order.create({
      data: {
        total_price: totalPrice,
        stripe_payment_id: paymentIntentId,
        card_last_four: cardLastFour,
        address_name: addressDetails.name,
        address_street: addressDetails.street,
        address_city: addressDetails.city,
        address_postcode: addressDetails.postcode,
        user_id: userId,
        items: { create: orderItems },
      },
      include: orderInclude,
    });
    await tx.cart.delete({ where: { id: cartId } });
    return created;
  });

  return formatOrder(order);
  ```

  to:

  ```ts
  const order = await prisma.$transaction(async (tx) => {
    const created = await tx.order.create({
      data: {
        total_price: totalPrice,
        stripe_payment_id: paymentIntentId,
        card_last_four: cardLastFour,
        address_name: addressDetails.name,
        address_street: addressDetails.street,
        address_city: addressDetails.city,
        address_postcode: addressDetails.postcode,
        user_id: userId,
        items: { create: orderItems },
      },
      include: orderInclude,
    });
    await tx.cart.delete({ where: { id: cartId } });
    return created;
  });

  const orderDTO = formatOrder(order);
  await sendOrderConfirmationEmail(orderDTO, order.user.email, order.user.name);

  return orderDTO;
  ```

  Note this calls `formatOrder(order)` once and reuses the result for both the email and the response — `sendOrderConfirmationEmail` is declared to take an `OrderDTO` (Task 3, Step 3), not the raw Prisma payload: the raw `order` has different field names (`address_name`/`address_street` instead of a nested `address_details`, `total_price` as a Prisma `Decimal`, etc.) and would neither type-check against `OrderConfirmationEmail`'s props nor render the right values. `formatOrder`'s function body itself is unchanged — it already whitelists exactly which fields appear in `OrderDTO`, so the added `user` relation on the query result is never exposed to the client via the API response.

- [ ] **Step 5: Run the tests again to verify they all pass**

  Run: `cd packages/api && bun run test -- orders.test.ts`
  Expected: PASS — both new tests green, and all pre-existing `orders.test.ts` tests (including the original happy-path order-creation test) still pass unchanged.

- [ ] **Step 6: Run the full API test suite and type-check**

  Run: `cd packages/api && bun run test && bunx tsc --noEmit`
  Expected: PASS with no errors.

- [ ] **Step 7: Commit**

  ```bash
  git add packages/api/src/features/orders/order-confirmation.email.tsx packages/api/src/features/orders/orders.service.ts packages/api/src/features/orders/orders.test.ts
  git commit -m "$(cat <<'EOF'
  Send an order confirmation email via Resend when an order is placed

  Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
  EOF
  )"
  ```

---

### Task 4: Document the MSW testing exception in ADR 001

**Files:**

- Modify: `docs/adr/001-testing-setup.md`

**Interfaces:** None — documentation only.

- [ ] **Step 1: Update the header date**

  Change:

  ```markdown
  **Date:** 2026-06-30 (amended 2026-07-01)
  ```

  to:

  ```markdown
  **Date:** 2026-06-30 (amended 2026-07-01, 2026-07-08)
  ```

- [ ] **Step 2: Add the new exception under the API testing section**

  In the `### API: Vitest with a real test database` section, change:

  ```markdown
  - **No mocks.** Tests hit a real PostgreSQL instance on port 5433 (`marketplace_test`), connected via the same Prisma client used in production.
  - **Single fork, serialized.** `pool: 'forks'` with `fileParallelism: false` prevents parallel test files from racing on shared DB state (Vitest 4 replaced the old `poolOptions.forks.singleFork` option with this top-level flag).
  - **Setup/teardown** is in `tests/setup.ts`: connects before the suite, disconnects after.
  ```

  to:

  ```markdown
  - **No mocks, with one exception.** Tests hit a real PostgreSQL instance on port 5433 (`marketplace_test`), connected via the same Prisma client used in production, and a real Stripe test-mode API for payment intents. The one exception: outbound transactional email via Resend is intercepted with `msw/node` (`tests/resend-mock.ts`, wired into `tests/setup.ts`) — added 2026-07-08 alongside the order confirmation email feature. Resend, unlike Stripe, has no test-mode affordance for deterministically triggering a send failure from CI, so its network boundary is mocked the same way the web package already mocks its own API calls (see UI section below) — this is the second deliberate exception to this ADR's "no mocks" stance, not an accidental one.
  - **Single fork, serialized.** `pool: 'forks'` with `fileParallelism: false` prevents parallel test files from racing on shared DB state (Vitest 4 replaced the old `poolOptions.forks.singleFork` option with this top-level flag).
  - **Setup/teardown** is in `tests/setup.ts`: connects before the suite, disconnects after, and starts/stops the MSW server intercepting Resend calls.
  ```

- [ ] **Step 3: Commit**

  ```bash
  git add docs/adr/001-testing-setup.md
  git commit -m "$(cat <<'EOF'
  Document the Resend MSW test exception in ADR 001

  Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
  EOF
  )"
  ```
