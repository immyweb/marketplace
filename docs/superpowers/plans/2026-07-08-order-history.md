# Order History Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a signed-in user see a list of their past orders and view the detail of any one of them, closing the ownership gap on `GET /order/:id` that ADR 006 flagged as a prerequisite for this feature.

**Architecture:** `packages/api`'s `orders` feature gains a `GET /order` list endpoint and an ownership check on the existing `GET /order/:id`, both behind `requireAuth`. `packages/web` gains `/orders` (list) and `/orders/[id]` (detail) pages, an "Orders" nav link, and a fix to the existing `order-confirmation/[id]` page so it keeps working once `GET /order/:id` requires auth.

**Tech Stack:** TypeScript, Express 5, Prisma 7 + PostgreSQL, Next.js App Router, Vitest, Supertest, React Testing Library, MSW.

## Global Constraints

- `GET /order/:id`: signed-out → 403 (via `requireAuth`, matching every other protected endpoint); signed-in but not the order's owner → 404 (not 403 — avoids confirming the order exists to a caller who doesn't own it).
- `GET /order` (list): no pagination — small scale, no production deployment target today (per ADR 002's Consequences reasoning).
- `packages/api` order/checkout tests run against real Postgres and real Stripe test-mode API calls — no mocking, except MSW for the Resend network call (the one documented exception).
- `packages/web` component tests use MSW-mocked network calls (`packages/web/tests/component`), per ADR 001. No new E2E tests — order history is not a checkout/cart/payment critical flow.
- Routes stay thin; business logic lives in `*.service.ts` (ADR 004).
- Full spec: `docs/superpowers/specs/2026-07-08-order-history-design.md`.

---

### Task 1: Core — `OrderSummary` type

**Files:**

- Modify: `packages/core/src/order/types.ts`

**Interfaces:**

- Produces: `OrderSummary` interface, importable as `import type { OrderSummary } from "@marketplace/core"` (already re-exported via `packages/core/src/index.ts`'s `export * from "./order/types"` — no change needed there).

- [ ] **Step 1: Add the `OrderSummary` type**

Add to the end of `packages/core/src/order/types.ts`:

```ts
export interface OrderSummary {
  id: number;
  created_at: string;
  status: string;
  total_price: number;
  currency: string;
  item_count: number;
}
```

- [ ] **Step 2: Build the core package**

Run: `cd packages/core && bun run build`
Expected: builds with no TypeScript errors.

- [ ] **Step 3: Commit**

```bash
git add packages/core/src/order/types.ts
git commit -m "Add OrderSummary type for order history list"
```

---

### Task 2: API — ownership check on `GET /order/:id`

**Files:**

- Modify: `packages/api/src/features/orders/orders.service.ts`
- Modify: `packages/api/src/features/orders/orders.routes.ts`
- Modify: `packages/api/src/features/orders/orders.test.ts`
- Modify: `docs/adr/006-authentication.md`

**Interfaces:**

- Consumes: `requireAuth` (`@/shared/middleware/require-auth`, sets `req.userId: string` or throws `ForbiddenError`), `NotFoundError` (`@/shared/errors`).
- Produces: `getOrderById(id: number, userId: string): Promise<OrderDTO>` (signature change — was `getOrderById(id: number)`).

- [ ] **Step 1: Update existing tests to sign in before calling `GET /order/:id`, and add ownership-check tests**

In `packages/api/src/features/orders/orders.test.ts`, replace the `describe("GET /order/:id", ...)` block with:

```ts
describe("GET /order/:id", () => {
  it("returns the order with items, address and payment details", async () => {
    const ag = agent(app);
    await signUpAgent(ag);
    const user = await prisma.user.findUniqueOrThrow({
      where: { email: "jane@example.com" },
    });
    const order = await prisma.order.create({
      data: {
        total_price: 30,
        stripe_payment_id: "pi_test_get_order",
        card_last_four: "4242",
        address_name: "Jane Smith",
        address_street: "10 Downing Street",
        address_city: "London",
        address_postcode: "SW1A 2AA",
        user_id: user.id,
        items: {
          create: [{ product_id: productId, quantity: 2, price: 30 }],
        },
      },
    });

    const res = await ag.get(`/order/${order.id}`).expect(200);

    expect(res.body).toMatchObject({
      id: order.id,
      total_price: 30,
      currency: "GBP",
      status: "confirmed",
      address_details: {
        name: "Jane Smith",
        street: "10 Downing Street",
        city: "London",
        postcode: "SW1A 2AA",
      },
      payment_details: { card_last_four_digits: "4242" },
    });
    expect(res.body.items).toEqual([
      {
        quantity: 2,
        price: 30,
        currency: "GBP",
        product: {
          id: productId,
          name: "Test Product",
          primary_image: "img.jpg",
        },
      },
    ]);
  });

  it("returns 403 for a signed-out request", async () => {
    const owner = await prisma.user.create({
      data: {
        id: "owner-1",
        name: "Owner",
        email: "owner1@example.com",
        emailVerified: true,
      },
    });
    const order = await prisma.order.create({
      data: {
        total_price: 30,
        stripe_payment_id: "pi_owner_1",
        card_last_four: "4242",
        address_name: "Owner",
        address_street: "1 St",
        address_city: "London",
        address_postcode: "SW1A 1AA",
        user_id: owner.id,
        items: { create: [{ product_id: productId, quantity: 1, price: 30 }] },
      },
    });

    const res = await agent(app).get(`/order/${order.id}`).expect(403);

    expect(res.body).toMatchObject({ error: expect.any(String) });
  });

  it("returns 404 when the order belongs to a different user", async () => {
    const owner = await prisma.user.create({
      data: {
        id: "owner-2",
        name: "Owner",
        email: "owner2@example.com",
        emailVerified: true,
      },
    });
    const order = await prisma.order.create({
      data: {
        total_price: 30,
        stripe_payment_id: "pi_owner_2",
        card_last_four: "4242",
        address_name: "Owner",
        address_street: "1 St",
        address_city: "London",
        address_postcode: "SW1A 1AA",
        user_id: owner.id,
        items: { create: [{ product_id: productId, quantity: 1, price: 30 }] },
      },
    });

    const ag = agent(app);
    await signUpAgent(ag, "someone-else@example.com");
    const res = await ag.get(`/order/${order.id}`).expect(404);

    expect(res.body).toMatchObject({ error: expect.any(String) });
  });

  it("returns 404 for an order id that does not exist", async () => {
    const ag = agent(app);
    await signUpAgent(ag);
    const res = await ag.get("/order/999999").expect(404);

    expect(res.body).toMatchObject({ error: expect.any(String) });
  });

  it("returns 404 for a non-numeric order id", async () => {
    const ag = agent(app);
    await signUpAgent(ag);
    const res = await ag.get("/order/not-a-number").expect(404);

    expect(res.body).toMatchObject({ error: expect.any(String) });
  });
});
```

- [ ] **Step 2: Run the test file to see the new/updated tests fail**

Ensure Docker Compose is running first (`docker compose up -d` from the repo root, per ADR 002 — the test DB is `marketplace_test` on port 5433).

Run: `cd packages/api && bunx vitest run src/features/orders/orders.test.ts`
Expected: FAIL — the "returns 403 for a signed-out request" and "returns 404 when the order belongs to a different user" tests fail (endpoint currently returns 200/data for any caller); the "returns the order..." test passing/failing depends on whether `requireAuth` is applied yet (it isn't, so it should currently pass, since the sign-in call is harmless) — the two new tests are the ones proving the gap.

- [ ] **Step 3: Add the ownership check in the service layer**

In `packages/api/src/features/orders/orders.service.ts`, change the `getOrderById` function:

```ts
export async function getOrderById(
  id: number,
  userId: string,
): Promise<OrderDTO> {
  const order = await prisma.order.findUnique({
    where: { id },
    include: orderInclude,
  });

  if (!order || order.user_id !== userId) {
    throw new NotFoundError("Order not found");
  }

  return formatOrder(order);
}
```

- [ ] **Step 4: Gate the route with `requireAuth` and pass `req.userId`**

In `packages/api/src/features/orders/orders.routes.ts`, add the `requireAuth` import (already imported for the `POST /` handler) and change the `GET /:id` handler:

```ts
router.get("/:id", requireAuth, async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      res.status(404).json({ error: "Order not found", code: "NOT_FOUND" });
      return;
    }

    const order = await getOrderById(id, req.userId!);
    res.json(order);
  } catch (err) {
    next(err);
  }
});
```

- [ ] **Step 5: Run the test file to verify it passes**

Run: `cd packages/api && bunx vitest run src/features/orders/orders.test.ts`
Expected: PASS — all tests in the file, including the full `POST /order`, `GET /order/:id`, and `POST /checkout/payment-intent` suites.

- [ ] **Step 6: Update ADR 006 to record the gap is closed**

In `docs/adr/006-authentication.md`, in the `## Consequences` section, replace this bullet:

```
- `GET /order/:id` has no ownership check — anyone with an order ID can currently read it. Acceptable for today's scope (no order-history UI exists yet to make IDs discoverable in bulk), but must be revisited before building order history.
```

with:

```
- `GET /order/:id` is now gated by `requireAuth` and checks `order.user_id === req.userId` (404 for a mismatch, 403 for signed-out) — closed 2026-07-08 as part of building order history. See `docs/superpowers/specs/2026-07-08-order-history-design.md`.
```

- [ ] **Step 7: Commit**

```bash
git add packages/api/src/features/orders/orders.service.ts packages/api/src/features/orders/orders.routes.ts packages/api/src/features/orders/orders.test.ts docs/adr/006-authentication.md
git commit -m "Require auth and ownership on GET /order/:id"
```

---

### Task 3: Web — fix `fetchOrder`/`order-confirmation` to forward the session cookie

**Context:** Task 2 made `GET /order/:id` require auth. `app/order-confirmation/[id]/page.tsx` (the existing post-checkout confirmation page) calls `fetchOrder(id)`, which today sends no cookies — it would start getting 403s for the user's own just-placed order. This task fixes that before the app is otherwise broken.

**Files:**

- Modify: `packages/web/lib/api.ts`
- Modify: `packages/web/app/order-confirmation/[id]/page.tsx`
- Modify: `packages/web/tests/component/order-confirmation-page.test.tsx`

**Interfaces:**

- Produces: `fetchOrder(id: number, init?: RequestInit): Promise<Order>` (signature change — was `fetchOrder(id: number)`).

- [ ] **Step 1: Write a failing test proving the cookie isn't forwarded today**

In `packages/web/tests/component/order-confirmation-page.test.tsx`, add the `next/headers` mock at the top of the file (it isn't there today, since the page doesn't call `headers()` yet):

```ts
vi.mock("next/headers", () => ({
  headers: () => Promise.resolve(new Headers({ cookie: "session=abc123" })),
}));
```

This requires adding `vi` to the existing `import { describe, it, expect } from "vitest";` line — change it to `import { describe, it, expect, vi } from "vitest";`.

Then add this test inside `describe("OrderConfirmationPage", ...)`:

```ts
it("forwards the session cookie when fetching the order", async () => {
  let receivedCookie: string | null = null;
  server.use(
    http.get("http://localhost:3001/order/:id", ({ request }) => {
      receivedCookie = request.headers.get("cookie");
      return HttpResponse.json(order);
    }),
  );

  await renderPage(String(order.id));

  expect(receivedCookie).toBe("session=abc123");
});
```

- [ ] **Step 2: Run the test file to see the new test fail**

Run: `cd packages/web && bunx vitest run tests/component/order-confirmation-page.test.tsx`
Expected: FAIL on "forwards the session cookie when fetching the order" — `receivedCookie` is `null`, not `"session=abc123"`.

- [ ] **Step 3: Update `fetchOrder` to accept and forward `init`**

In `packages/web/lib/api.ts`, change:

```ts
export function fetchOrder(id: number) {
  return apiFetch<Order>(`/order/${id}`);
}
```

to:

```ts
export function fetchOrder(id: number, init?: RequestInit) {
  return apiFetch<Order>(`/order/${id}`, init);
}
```

- [ ] **Step 4: Forward the cookie from the page**

In `packages/web/app/order-confirmation/[id]/page.tsx`, add the `headers` import and thread the cookie through:

```ts
import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { ApiRequestError, fetchOrder } from "@/lib/api";

interface Props {
  params: Promise<{ id: string }>;
}

async function fetchOrderOrNotFound(id: number, cookie: string | null) {
  try {
    return await fetchOrder(
      id,
      cookie ? { headers: { Cookie: cookie } } : undefined,
    );
  } catch (err) {
    if (err instanceof ApiRequestError && err.status === 404) return null;
    throw err;
  }
}

export const metadata: Metadata = { title: "Order Confirmed" };

export default async function OrderConfirmationPage({ params }: Props) {
  const { id } = await params;
  const cookie = (await headers()).get("cookie");
  const order = await fetchOrderOrNotFound(parseInt(id, 10), cookie);

  if (!order) notFound();

  // ...rest of the component is unchanged
```

Only the top of the file changes (imports, `fetchOrderOrNotFound`'s signature, and the two lines at the start of the component body); the JSX below `if (!order) notFound();` is untouched.

- [ ] **Step 5: Run the test file to verify it passes**

Run: `cd packages/web && bunx vitest run tests/component/order-confirmation-page.test.tsx`
Expected: PASS — all tests, including the new one and the pre-existing four.

- [ ] **Step 6: Commit**

```bash
git add packages/web/lib/api.ts packages/web/app/order-confirmation/[id]/page.tsx packages/web/tests/component/order-confirmation-page.test.tsx
git commit -m "Forward session cookie when fetching order confirmation"
```

---

### Task 4: API — `GET /order` list endpoint

**Files:**

- Modify: `packages/api/src/features/orders/orders.service.ts`
- Modify: `packages/api/src/features/orders/orders.routes.ts`
- Modify: `packages/api/src/features/orders/orders.test.ts`

**Interfaces:**

- Consumes: `OrderSummary` (`@marketplace/core`, Task 1), `requireAuth`.
- Produces: `listOrdersByUser(userId: string): Promise<OrderSummary[]>`.

- [ ] **Step 1: Write the failing tests**

Add this new `describe` block to `packages/api/src/features/orders/orders.test.ts` (after the `describe("GET /order/:id", ...)` block):

```ts
describe("GET /order", () => {
  it("returns the signed-in user's orders, newest first, with summary fields", async () => {
    const ag = agent(app);
    await signUpAgent(ag);
    const user = await prisma.user.findUniqueOrThrow({
      where: { email: "jane@example.com" },
    });

    const older = await prisma.order.create({
      data: {
        total_price: 15,
        stripe_payment_id: "pi_list_1",
        card_last_four: "4242",
        address_name: "Jane",
        address_street: "1 St",
        address_city: "London",
        address_postcode: "SW1A 1AA",
        user_id: user.id,
        created_at: new Date("2026-01-01T00:00:00.000Z"),
        items: { create: [{ product_id: productId, quantity: 1, price: 15 }] },
      },
    });
    const newer = await prisma.order.create({
      data: {
        total_price: 30,
        stripe_payment_id: "pi_list_2",
        card_last_four: "4242",
        address_name: "Jane",
        address_street: "1 St",
        address_city: "London",
        address_postcode: "SW1A 1AA",
        user_id: user.id,
        created_at: new Date("2026-02-01T00:00:00.000Z"),
        items: {
          create: [
            { product_id: productId, quantity: 1, price: 15 },
            { product_id: productId, quantity: 1, price: 15 },
          ],
        },
      },
    });

    const res = await ag.get("/order").expect(200);

    expect(res.body).toEqual([
      {
        id: newer.id,
        created_at: newer.created_at.toISOString(),
        status: "confirmed",
        total_price: 30,
        currency: "GBP",
        item_count: 2,
      },
      {
        id: older.id,
        created_at: older.created_at.toISOString(),
        status: "confirmed",
        total_price: 15,
        currency: "GBP",
        item_count: 1,
      },
    ]);
  });

  it("does not include another user's orders", async () => {
    const owner = await prisma.user.create({
      data: {
        id: "owner-3",
        name: "Owner",
        email: "owner3@example.com",
        emailVerified: true,
      },
    });
    await prisma.order.create({
      data: {
        total_price: 10,
        stripe_payment_id: "pi_other_user",
        card_last_four: "4242",
        address_name: "Owner",
        address_street: "1 St",
        address_city: "London",
        address_postcode: "SW1A 1AA",
        user_id: owner.id,
        items: { create: [{ product_id: productId, quantity: 1, price: 10 }] },
      },
    });

    const ag = agent(app);
    await signUpAgent(ag, "self@example.com");

    const res = await ag.get("/order").expect(200);

    expect(res.body).toEqual([]);
  });

  it("returns an empty array when the user has no orders", async () => {
    const ag = agent(app);
    await signUpAgent(ag);

    const res = await ag.get("/order").expect(200);

    expect(res.body).toEqual([]);
  });

  it("returns 403 when listing orders without signing in", async () => {
    const res = await agent(app).get("/order").expect(403);

    expect(res.body).toMatchObject({ error: expect.any(String) });
  });
});
```

- [ ] **Step 2: Run the test file to see the new tests fail**

Run: `cd packages/api && bunx vitest run src/features/orders/orders.test.ts`
Expected: FAIL — `GET /order` doesn't exist yet, so these requests 404 (Express's default 404, not the app's `NotFoundError` shape) or otherwise don't match the expected bodies.

- [ ] **Step 3: Add `listOrdersByUser` to the service**

In `packages/api/src/features/orders/orders.service.ts`, add the `OrderSummary` import and the new function:

```ts
import type { OrderSummary } from "@marketplace/core";
```

(add alongside the existing `import type { AddressInput } from "@marketplace/core";` — combine into one import: `import type { AddressInput, OrderSummary } from "@marketplace/core";`)

```ts
export async function listOrdersByUser(
  userId: string,
): Promise<OrderSummary[]> {
  const orders = await prisma.order.findMany({
    where: { user_id: userId },
    orderBy: { created_at: "desc" },
    select: {
      id: true,
      created_at: true,
      status: true,
      total_price: true,
      currency: true,
      _count: { select: { items: true } },
    },
  });

  return orders.map((order) => ({
    id: order.id,
    created_at: order.created_at.toISOString(),
    status: order.status,
    total_price: Number(order.total_price),
    currency: order.currency,
    item_count: order._count.items,
  }));
}
```

- [ ] **Step 4: Add the route**

In `packages/api/src/features/orders/orders.routes.ts`, add the `listOrdersByUser` import and a new handler. Place it before the `POST /` handler for readability:

```ts
import { placeOrder, getOrderById, listOrdersByUser } from "./orders.service";
```

```ts
router.get("/", requireAuth, async (req, res, next) => {
  try {
    const orders = await listOrdersByUser(req.userId!);
    res.json(orders);
  } catch (err) {
    next(err);
  }
});
```

- [ ] **Step 5: Run the test file to verify it passes**

Run: `cd packages/api && bunx vitest run src/features/orders/orders.test.ts`
Expected: PASS — full file, all describe blocks.

- [ ] **Step 6: Run the full API test suite**

Run: `cd packages/api && bun run test`
Expected: PASS — no regressions elsewhere (e.g. `cart`, `products`, `checkout` feature tests).

- [ ] **Step 7: Commit**

```bash
git add packages/api/src/features/orders/orders.service.ts packages/api/src/features/orders/orders.routes.ts packages/api/src/features/orders/orders.test.ts
git commit -m "Add GET /order list endpoint for order history"
```

---

### Task 5: Web — `/orders` list page

**Files:**

- Modify: `packages/web/lib/api.ts`
- Modify: `packages/web/tests/component/msw-handlers.ts`
- Create: `packages/web/app/orders/page.tsx`
- Create: `packages/web/tests/component/orders-page.test.tsx`

**Interfaces:**

- Consumes: `getServerSession()` (`@/lib/get-server-session`), `OrderSummary` (`@marketplace/core`).
- Produces: `fetchOrders(init?: RequestInit): Promise<OrderSummary[]>` (`@/lib/api`).

- [ ] **Step 1: Add `fetchOrders` to the API client**

In `packages/web/lib/api.ts`, add the `OrderSummary` import (extend the existing `import type { AddressDetails, Cart, Order, Product } from "@marketplace/core";` to `import type { AddressDetails, Cart, Order, OrderSummary, Product } from "@marketplace/core";`), then add, near `fetchOrder`:

```ts
export function fetchOrders(init?: RequestInit) {
  return apiFetch<OrderSummary[]>("/order", init);
}
```

- [ ] **Step 2: Add default MSW handlers for the order list**

In `packages/web/tests/component/msw-handlers.ts`, add a new fixture and handler. Add after the existing `order` export:

```ts
export const orderSummaries = [
  {
    id: order.id,
    created_at: "2026-07-01T10:00:00.000Z",
    status: "confirmed",
    total_price: order.total_price,
    currency: order.currency,
    item_count: order.items.length,
  },
];
```

Add to the `handlers` array (after the existing `GET ${API_URL}/order/:id` handler):

```ts
  http.get(`${API_URL}/order`, () => {
    return HttpResponse.json(orderSummaries);
  }),
```

- [ ] **Step 3: Write the failing test**

Create `packages/web/tests/component/orders-page.test.tsx`:

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { server } from "./setup";
import { orderSummaries } from "./msw-handlers";
import OrdersPage from "@/app/orders/page";

const API_URL = "http://localhost:3001";

vi.mock("next/headers", () => ({
  headers: () => Promise.resolve(new Headers()),
}));

const { redirect } = vi.hoisted(() => ({
  redirect: vi.fn((url: string) => {
    throw new Error(`REDIRECT:${url}`);
  }),
}));

vi.mock("next/navigation", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/navigation")>()),
  redirect,
}));

function mockSignedIn() {
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
}

describe("OrdersPage", () => {
  it("redirects to sign-in when there is no session", async () => {
    server.use(
      http.get(`${API_URL}/api/auth/get-session`, () =>
        HttpResponse.json(null),
      ),
    );

    await expect(OrdersPage()).rejects.toThrow(
      "REDIRECT:/sign-in?redirect=/orders",
    );
  });

  it("shows an empty state when the user has no orders", async () => {
    mockSignedIn();
    server.use(http.get(`${API_URL}/order`, () => HttpResponse.json([])));

    render(await OrdersPage());

    expect(
      screen.getByText("You haven't placed any orders yet."),
    ).toBeInTheDocument();
  });

  it("lists the user's orders, linking each to its detail page", async () => {
    mockSignedIn();

    render(await OrdersPage());

    const list = screen.getByRole("list", { name: "Order history" });
    expect(list).toHaveTextContent(`#${orderSummaries[0].id}`);
    expect(list).toHaveTextContent(
      `£${orderSummaries[0].total_price.toFixed(2)}`,
    );
    expect(list).toHaveTextContent(orderSummaries[0].status);

    const link = screen.getByRole("link", {
      name: new RegExp(`#${orderSummaries[0].id}`),
    });
    expect(link).toHaveAttribute("href", `/orders/${orderSummaries[0].id}`);
  });
});
```

- [ ] **Step 4: Run the test to verify it fails**

Run: `cd packages/web && bunx vitest run tests/component/orders-page.test.tsx`
Expected: FAIL — `Cannot find module '@/app/orders/page'` (the page doesn't exist yet).

- [ ] **Step 5: Create the page**

Create `packages/web/app/orders/page.tsx`:

```tsx
import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getServerSession } from "@/lib/get-server-session";
import { fetchOrders } from "@/lib/api";

export const metadata: Metadata = { title: "Order History" };

export default async function OrdersPage() {
  const session = await getServerSession();

  if (!session) {
    redirect("/sign-in?redirect=/orders");
  }

  const cookie = (await headers()).get("cookie");
  const orders = await fetchOrders(
    cookie ? { headers: { Cookie: cookie } } : undefined,
  );

  return (
    <>
      <h1 className="text-2xl">Order History</h1>
      {orders.length === 0 ? (
        <p className="mt-8 text-muted-foreground">
          You haven&apos;t placed any orders yet.{" "}
          <Link
            href="/"
            className="text-secondary underline underline-offset-4"
          >
            Browse products
          </Link>
        </p>
      ) : (
        <ul aria-label="Order history" className="mt-8 list-none space-y-1 p-0">
          {orders.map((order) => (
            <li key={order.id}>
              <Link
                href={`/orders/${order.id}`}
                className="flex flex-wrap items-baseline gap-x-3 border-b border-dashed border-border py-3 font-mono text-sm hover:text-accent"
              >
                <span>#{order.id}</span>
                <span>
                  {new Date(order.created_at).toLocaleDateString("en-GB", {
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  })}
                </span>
                <span>
                  {order.item_count} item{order.item_count !== 1 ? "s" : ""}
                </span>
                <span>£{order.total_price.toFixed(2)}</span>
                <span className="uppercase">{order.status}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
```

- [ ] **Step 6: Run the test to verify it passes**

Run: `cd packages/web && bunx vitest run tests/component/orders-page.test.tsx`
Expected: PASS — all three tests.

- [ ] **Step 7: Commit**

```bash
git add packages/web/lib/api.ts packages/web/tests/component/msw-handlers.ts packages/web/app/orders/page.tsx packages/web/tests/component/orders-page.test.tsx
git commit -m "Add /orders order history list page"
```

---

### Task 6: Web — `/orders/[id]` detail page

**Files:**

- Create: `packages/web/app/orders/[id]/page.tsx`
- Create: `packages/web/tests/component/orders-detail-page.test.tsx`

**Interfaces:**

- Consumes: `fetchOrder(id, init?)` (`@/lib/api`, Task 3), `getServerSession()`, `ApiRequestError`.

- [ ] **Step 1: Write the failing test**

Create `packages/web/tests/component/orders-detail-page.test.tsx`:

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { server } from "./setup";
import { order } from "./msw-handlers";
import OrderDetailPage from "@/app/orders/[id]/page";

const API_URL = "http://localhost:3001";

vi.mock("next/headers", () => ({
  headers: () => Promise.resolve(new Headers()),
}));

const { redirect } = vi.hoisted(() => ({
  redirect: vi.fn((url: string) => {
    throw new Error(`REDIRECT:${url}`);
  }),
}));

vi.mock("next/navigation", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/navigation")>()),
  redirect,
}));

function mockSignedIn() {
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
}

function renderPage(id: string) {
  return OrderDetailPage({ params: Promise.resolve({ id }) });
}

describe("OrderDetailPage", () => {
  it("redirects to sign-in when there is no session", async () => {
    server.use(
      http.get(`${API_URL}/api/auth/get-session`, () =>
        HttpResponse.json(null),
      ),
    );

    await expect(renderPage(String(order.id))).rejects.toThrow(
      `REDIRECT:/sign-in?redirect=/orders/${order.id}`,
    );
  });

  it("renders order details for a known order", async () => {
    mockSignedIn();

    render(await renderPage(String(order.id)));

    expect(
      screen.getByRole("article", { name: "Order details" }),
    ).toBeInTheDocument();
    expect(screen.getByText(`Order #${order.id}`)).toBeInTheDocument();
    expect(
      screen.getByText(
        `${order.items[0].product.name} × ${order.items[0].quantity} — £${order.items[0].price.toFixed(2)}`,
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByLabelText(`Total: £${order.total_price.toFixed(2)}`),
    ).toBeInTheDocument();

    const delivery = screen.getByRole("region", { name: "Delivery details" });
    expect(delivery).toHaveTextContent(order.address_details.name);

    expect(
      screen.getByText(
        `Card ending in ${order.payment_details.card_last_four_digits}`,
      ),
    ).toBeInTheDocument();
  });

  it("throws a Next.js not-found error for an unknown order id", async () => {
    mockSignedIn();
    server.use(
      http.get(`${API_URL}/order/:id`, () =>
        HttpResponse.json({ error: "Order not found" }, { status: 404 }),
      ),
    );

    await expect(renderPage("999999")).rejects.toMatchObject({
      digest: "NEXT_HTTP_ERROR_FALLBACK;404",
    });
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd packages/web && bunx vitest run tests/component/orders-detail-page.test.tsx`
Expected: FAIL — `Cannot find module '@/app/orders/[id]/page'`.

- [ ] **Step 3: Create the page**

Create `packages/web/app/orders/[id]/page.tsx`:

```tsx
import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import { redirect, notFound } from "next/navigation";
import { getServerSession } from "@/lib/get-server-session";
import { ApiRequestError, fetchOrder } from "@/lib/api";

interface Props {
  params: Promise<{ id: string }>;
}

async function fetchOrderOrNotFound(id: number, cookie: string | null) {
  try {
    return await fetchOrder(
      id,
      cookie ? { headers: { Cookie: cookie } } : undefined,
    );
  } catch (err) {
    if (err instanceof ApiRequestError && err.status === 404) return null;
    throw err;
  }
}

export const metadata: Metadata = { title: "Order Details" };

export default async function OrderDetailPage({ params }: Props) {
  const { id } = await params;
  const session = await getServerSession();

  if (!session) {
    redirect(`/sign-in?redirect=/orders/${id}`);
  }

  const cookie = (await headers()).get("cookie");
  const order = await fetchOrderOrNotFound(parseInt(id, 10), cookie);

  if (!order) notFound();

  return (
    <article aria-label="Order details" className="max-w-2xl">
      <h1 className="text-2xl">Order #{order.id}</h1>

      <section
        aria-label="Order summary"
        className="mt-8 border-t border-dashed border-border pt-6"
      >
        <h2 className="text-lg">Order Summary</h2>
        <ul className="mt-3 list-none p-0">
          {order.items.map((item) => (
            <li key={item.product.id} className="py-1 font-mono text-sm">
              {item.product.name} × {item.quantity} — £{item.price.toFixed(2)}
            </li>
          ))}
        </ul>
        <p
          aria-label={`Total: £${order.total_price.toFixed(2)}`}
          className="mt-4 font-display text-lg font-bold tracking-wide uppercase"
        >
          Total: £{order.total_price.toFixed(2)}
        </p>
      </section>

      <section
        aria-label="Delivery details"
        className="mt-6 border-t border-dashed border-border pt-6"
      >
        <h2 className="text-lg">Delivered to</h2>
        <address className="mt-2 leading-relaxed not-italic">
          {order.address_details.name}
          <br />
          {order.address_details.street}
          <br />
          {order.address_details.city}
          <br />
          {order.address_details.postcode}
        </address>
      </section>

      <section
        aria-label="Payment details"
        className="mt-6 border-t border-dashed border-border pt-6"
      >
        <h2 className="text-lg">Payment</h2>
        <p className="mt-2">
          Card ending in {order.payment_details.card_last_four_digits}
        </p>
      </section>

      <Link
        href="/orders"
        className="mt-8 inline-block font-mono text-sm tracking-wide text-secondary underline underline-offset-4"
      >
        Back to Order History
      </Link>
    </article>
  );
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd packages/web && bunx vitest run tests/component/orders-detail-page.test.tsx`
Expected: PASS — all three tests.

- [ ] **Step 5: Commit**

```bash
git add packages/web/app/orders/[id]/page.tsx packages/web/tests/component/orders-detail-page.test.tsx
git commit -m "Add /orders/[id] order detail page"
```

---

### Task 7: Web — "Orders" nav link

**Files:**

- Modify: `packages/web/components/nav.tsx`
- Modify: `packages/web/tests/component/nav.test.tsx`

- [ ] **Step 1: Write the failing test**

In `packages/web/tests/component/nav.test.tsx`, update the `"shows the user's name and a sign-out control when logged in"` test to also assert the new link:

```ts
it("shows the user's name and a sign-out control when logged in", async () => {
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

  expect(screen.getByText("Ada")).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "Orders" })).toHaveAttribute(
    "href",
    "/orders",
  );
  expect(screen.getByRole("button", { name: "Sign out" })).toBeInTheDocument();
  expect(
    screen.queryByRole("link", { name: "Sign in" }),
  ).not.toBeInTheDocument();
});
```

Also add a case to the signed-out test to confirm the link is absent — extend the `"shows a sign-in link when logged out"` test with:

```ts
expect(screen.queryByRole("link", { name: "Orders" })).not.toBeInTheDocument();
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd packages/web && bunx vitest run tests/component/nav.test.tsx`
Expected: FAIL — no "Orders" link exists yet.

- [ ] **Step 3: Add the link**

In `packages/web/components/nav.tsx`, change the signed-in branch:

```tsx
          {session ? (
            <div className="flex items-center gap-3 font-mono text-sm tracking-wide uppercase">
              <span>{session.user.name}</span>
              <Link href="/orders" className="hover:text-accent">
                Orders
              </Link>
              <SignOutButton />
            </div>
          ) : (
```

(Only the `<Link href="/orders">Orders</Link>` line is new — `Link` is already imported at the top of the file.)

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd packages/web && bunx vitest run tests/component/nav.test.tsx`
Expected: PASS — both tests.

- [ ] **Step 5: Run the full web test suite**

Run: `cd packages/web && bun run test`
Expected: PASS — no regressions (e.g. `checkout-page-auth-gate`, `cart-page`, `product-listing-page`).

- [ ] **Step 6: Commit**

```bash
git add packages/web/components/nav.tsx packages/web/tests/component/nav.test.tsx
git commit -m "Add Orders link to nav for signed-in users"
```

---

### Task 8: Manual verification

- [ ] **Step 1: Start the stack**

Run: `docker compose up -d` (from repo root, if not already running), then `bun run dev` (starts both `api` and `web`).

- [ ] **Step 2: Walk the flow in a browser**

1. Sign up/sign in at `http://localhost:3000/sign-in`.
2. Add a product to cart and complete checkout with a Stripe test card (`4242 4242 4242 4242`) to create at least one real order.
3. Click "Orders" in the nav → confirm the order appears in `/orders` with correct date/item count/total/status.
4. Click into the order → confirm `/orders/[id]` shows the same detail sections as the post-checkout confirmation page, with "Order #N" framing (not "Order Confirmed").
5. Sign out, visit `/orders` directly → confirm redirect to `/sign-in?redirect=/orders`.
6. Sign in as a second user with no orders → confirm the empty state renders on `/orders`.

- [ ] **Step 3: Report results**

No commit for this task — it's verification only. Note any discrepancies found for follow-up.
