# API Feature-Based Folder Restructure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reorganize `packages/api/src` from a flat MVC-style layout (`routes/`, `services/`, `middleware/`, `db/`, `types/`) into a feature-based layout (`src/features/<name>/` per resource, `src/shared/` for cross-cutting code), with zero logic or behavior changes.

**Architecture:** Pure move-and-rewire refactor. Move cross-cutting code into `src/shared/` first so every subsequent feature move only has to point at one stable shared location. Then move each resource (products, cart, checkout, orders) one at a time into `src/features/<name>/`, updating only import paths. Every task ends with the full API test suite green.

**Tech Stack:** TypeScript, Express 5, Prisma 7, Vitest + Supertest, Bun workspaces.

## Global Constraints

- No logic changes anywhere — this is file moves and import path edits only. Response bodies, status codes, and error `code` values must stay byte-identical (per ADR 004 and the design spec `docs/superpowers/specs/2026-07-06-api-feature-based-restructure-design.md`).
- No new test coverage added for existing gaps (checkout still has no dedicated test file after this plan).
- No barrel `index.ts` files per feature — `app.ts` imports each `*.routes.ts` directly.
- `tests/setup.ts` stays at `packages/api/tests/setup.ts` (global vitest bootstrap, referenced by `vitest.config.ts`'s `setupFiles`) — never moves into `src/`.
- Use `git mv` for every file relocation so history is preserved.
- Run `bun run test:api` (from repo root) after every task and confirm all tests pass before committing.

---

### Task 1: Move cross-cutting code into `src/shared/`

**Files:**

- Create (via `git mv`): `packages/api/src/shared/errors.ts`, `packages/api/src/shared/stripe.ts`, `packages/api/src/shared/db/prisma.ts`, `packages/api/src/shared/types/session.d.ts`, `packages/api/src/shared/middleware/error.ts`, `packages/api/src/shared/middleware/session.ts`, `packages/api/src/shared/middleware/error.test.ts`
- Modify: `packages/api/src/app.ts`, `packages/api/src/routes/products.ts`, `packages/api/src/routes/cart.ts`, `packages/api/src/routes/checkout.ts`, `packages/api/src/routes/orders.ts`, `packages/api/src/services/products.service.ts`, `packages/api/src/services/cart.service.ts`, `packages/api/src/services/checkout.service.ts`, `packages/api/src/services/orders.service.ts`, `packages/api/tests/setup.ts`
- Delete: `packages/api/tests/error-handler.test.ts` (moved, see above), old `packages/api/src/errors.ts`, `packages/api/src/services/stripe.ts`, `packages/api/src/db/prisma.ts`, `packages/api/src/types/session.d.ts`, `packages/api/src/middleware/error.ts`, `packages/api/src/middleware/session.ts` (all removed by `git mv` in step 1)

**Interfaces:**

- Produces: `../../shared/errors.js` exports `AppError`, `NotFoundError`, `ForbiddenError`, `PaymentFailedError` (unchanged). `../../shared/db/prisma.js` exports `prisma` (unchanged). `../../shared/stripe.js` exports `stripe` (unchanged). `../../shared/middleware/error.js` exports `errorHandler` (unchanged). `../../shared/middleware/session.js` exports `sessionMiddleware` (unchanged). These are the paths every later task's feature files will import from.

- [ ] **Step 1: Move the six shared files and the error-handler test with `git mv`**

Run from `packages/api/`:

```bash
mkdir -p src/shared/db src/shared/types src/shared/middleware
git mv src/errors.ts src/shared/errors.ts
git mv src/services/stripe.ts src/shared/stripe.ts
git mv src/db/prisma.ts src/shared/db/prisma.ts
git mv src/types/session.d.ts src/shared/types/session.d.ts
git mv src/middleware/error.ts src/shared/middleware/error.ts
git mv src/middleware/session.ts src/shared/middleware/session.ts
git mv tests/error-handler.test.ts src/shared/middleware/error.test.ts
rmdir src/db src/types src/middleware 2>/dev/null || true
```

(`errors.ts`, `stripe.ts`, `prisma.ts`, `session.d.ts`, `error.ts`, `session.ts` need no internal edits — none of them import anything that just moved. `middleware/error.ts` imports `AppError` from `../errors.js`, which is now a sibling-of-parent path: `../errors.js` from `src/shared/middleware/error.ts` still correctly resolves to `src/shared/errors.ts`, so it is unchanged.)

- [ ] **Step 2: Update the moved error-handler test's imports**

Replace the contents of `packages/api/src/shared/middleware/error.test.ts` with:

```ts
import { describe, it, expect, vi } from "vitest";
import { errorHandler } from "./error.js";
import { NotFoundError } from "../errors.js";

function createRes() {
  const res: any = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res;
}

describe("errorHandler", () => {
  it("maps AppError subclasses to their status code and code", () => {
    const res = createRes();

    errorHandler(
      new NotFoundError("Widget not found"),
      {} as any,
      res,
      vi.fn(),
    );

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({
      error: "Widget not found",
      code: "NOT_FOUND",
    });
  });

  it("falls back to 500 INTERNAL_ERROR for unknown errors", () => {
    const res = createRes();
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    errorHandler(new Error("boom"), {} as any, res, vi.fn());

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      error: "Internal server error",
      code: "INTERNAL_ERROR",
    });

    consoleSpy.mockRestore();
  });
});
```

- [ ] **Step 3: Update `tests/setup.ts`'s prisma import**

Replace the contents of `packages/api/tests/setup.ts` with:

```ts
import { afterAll, beforeAll } from "vitest";
import { prisma } from "../src/shared/db/prisma.js";

beforeAll(async () => {
  process.env.DATABASE_URL =
    "postgresql://marketplace:marketplace@localhost:5433/marketplace_test";
  await prisma.$connect();
});

afterAll(async () => {
  await prisma.$disconnect();
});
```

- [ ] **Step 4: Update `app.ts`'s middleware imports**

Replace the contents of `packages/api/src/app.ts` with:

```ts
import "dotenv/config";
import express from "express";
import cors from "cors";
import { sessionMiddleware } from "./shared/middleware/session.js";
import { errorHandler } from "./shared/middleware/error.js";
import productsRouter from "./routes/products.js";
import cartRouter from "./routes/cart.js";
import checkoutRouter from "./routes/checkout.js";
import ordersRouter from "./routes/orders.js";

export const app = express();

app.use(cors({ origin: "http://localhost:3000", credentials: true }));
app.use(express.json());
app.use(sessionMiddleware);

app.get("/health", (_req, res) => res.json({ status: "ok" }));

app.use("/products", productsRouter);
app.use("/cart", cartRouter);
app.use("/checkout", checkoutRouter);
app.use("/order", ordersRouter);

app.use(errorHandler);
```

(The four route imports stay at `./routes/*.js` for now — Tasks 2–5 update each one as its feature folder moves.)

- [ ] **Step 5: Update the four still-in-place route files' shared imports**

Replace the contents of `packages/api/src/routes/orders.ts` with:

```ts
import { Router } from "express";
import { PlaceOrderSchema } from "@marketplace/core";
import { ForbiddenError } from "../shared/errors.js";
import { placeOrder, getOrderById } from "../services/orders.service.js";

const router = Router();

router.post("/", async (req, res, next) => {
  try {
    const parsed = PlaceOrderSchema.safeParse(req.body);
    if (!parsed.success) {
      res
        .status(400)
        .json({ error: parsed.error.errors[0].message, code: "INVALID_INPUT" });
      return;
    }
    const { cartId, paymentIntentId, address_details } = parsed.data;

    // Ensure the cart belongs to the current session to prevent IDOR
    if (cartId !== req.session.cartId) {
      throw new ForbiddenError("Cart does not belong to this session");
    }

    const order = await placeOrder({
      cartId,
      paymentIntentId,
      addressDetails: address_details,
    });

    req.session.cartId = undefined;
    res.status(201).json(order);
  } catch (err) {
    next(err);
  }
});

router.get("/:id", async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      res.status(404).json({ error: "Order not found", code: "NOT_FOUND" });
      return;
    }

    const order = await getOrderById(id);
    res.json(order);
  } catch (err) {
    next(err);
  }
});

export default router;
```

Replace the contents of `packages/api/src/routes/checkout.ts` with:

```ts
import { Router } from "express";
import { ForbiddenError } from "../shared/errors.js";
import { createPaymentIntent } from "../services/checkout.service.js";

const router = Router();

router.post("/payment-intent", async (req, res, next) => {
  try {
    const { cartId } = req.body as { cartId?: unknown };

    if (typeof cartId !== "number") {
      res
        .status(400)
        .json({ error: "cartId is required", code: "INVALID_INPUT" });
      return;
    }

    if (cartId !== req.session.cartId) {
      throw new ForbiddenError("Cart does not belong to this session");
    }

    const result = await createPaymentIntent(cartId);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

export default router;
```

`packages/api/src/routes/products.ts` and `packages/api/src/routes/cart.ts` import no shared code directly (only their own service and `@marketplace/core`) — no edit needed for either.

- [ ] **Step 6: Update the four services' shared imports**

Replace the contents of `packages/api/src/services/products.service.ts`'s import block (lines 1-2) — full file:

```ts
import { prisma } from "../shared/db/prisma.js";
import { NotFoundError } from "../shared/errors.js";
import type { ProductListQuery } from "@marketplace/core";

export type ProductDTO = {
  id: number;
  name: string;
  primary_image: string;
  unit_price: number;
  currency: string;
  category: string;
};

const PAGE_SIZE = 16;

export async function listProducts(query: ProductListQuery): Promise<{
  results: ProductDTO[];
  total: number;
  page: number;
  totalPages: number;
}> {
  const { page, sort, category } = query;
  const where = category ? { category } : undefined;
  const orderBy =
    sort === "category"
      ? [{ category: "asc" as const }, { id: "asc" as const }]
      : sort === "price_asc"
        ? [{ unit_price: "asc" as const }, { id: "asc" as const }]
        : sort === "price_desc"
          ? [{ unit_price: "desc" as const }, { id: "asc" as const }]
          : { id: "asc" as const };

  const [products, total] = await Promise.all([
    prisma.product.findMany({
      where,
      orderBy,
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        id: true,
        name: true,
        primary_image: true,
        unit_price: true,
        currency: true,
        category: true,
      },
    }),
    prisma.product.count({ where }),
  ]);

  return {
    results: products.map((p) => ({
      ...p,
      unit_price: Number(p.unit_price),
    })),
    total,
    page,
    totalPages: Math.ceil(total / PAGE_SIZE),
  };
}

export async function getProductById(id: number) {
  const product = await prisma.product.findUnique({ where: { id } });

  if (!product) {
    throw new NotFoundError("Product not found");
  }

  return { ...product, unit_price: Number(product.unit_price) };
}
```

Replace the contents of `packages/api/src/services/cart.service.ts`'s import block (lines 1-3) only, keeping the rest of the file identical:

```ts
import type { Prisma } from "@prisma/client";
import { prisma } from "../shared/db/prisma.js";
import { NotFoundError } from "../shared/errors.js";
```

Replace the contents of `packages/api/src/services/checkout.service.ts` — full file:

```ts
import { prisma } from "../shared/db/prisma.js";
import { NotFoundError } from "../shared/errors.js";
import { stripe } from "../shared/stripe.js";

export async function createPaymentIntent(
  cartId: number,
): Promise<{ clientSecret: string; amount: number }> {
  const cart = await prisma.cart.findUnique({
    where: { id: cartId },
    include: { items: { include: { product: true } } },
  });

  if (!cart || cart.items.length === 0) {
    throw new NotFoundError("Cart not found or empty");
  }

  const totalPence = Math.round(
    cart.items.reduce(
      (sum, item) => sum + Number(item.product.unit_price) * item.quantity,
      0,
    ) * 100,
  );

  const paymentIntent = await stripe.paymentIntents.create({
    amount: totalPence,
    currency: "gbp",
    automatic_payment_methods: { enabled: true, allow_redirects: "never" },
    metadata: { cartId: String(cartId) },
  });

  if (!paymentIntent.client_secret) {
    throw new Error("Stripe did not return a client_secret");
  }

  return {
    clientSecret: paymentIntent.client_secret,
    amount: totalPence / 100,
  };
}
```

Replace the contents of `packages/api/src/services/orders.service.ts`'s import block (lines 1-6) only, keeping the rest of the file identical:

```ts
import type Stripe from "stripe";
import type { Prisma } from "@prisma/client";
import type { AddressInput } from "@marketplace/core";
import { prisma } from "../shared/db/prisma.js";
import { NotFoundError, PaymentFailedError } from "../shared/errors.js";
import { stripe } from "../shared/stripe.js";
```

- [ ] **Step 7: Run the full API test suite and confirm it passes**

Run from the repo root: `bun run test:api`
Expected: All existing test files pass — `tests/cart.test.ts`, `tests/orders.test.ts`, `tests/products.test.ts`, and the relocated `src/shared/middleware/error.test.ts` (Vitest's default glob picks up `*.test.ts` anywhere under the package, so no config change is needed).

- [ ] **Step 8: Commit**

```bash
git add -A packages/api/src packages/api/tests
git commit -m "Move cross-cutting API code into src/shared/"
```

---

### Task 2: Move the `products` feature into `src/features/products/`

**Files:**

- Create (via `git mv`): `packages/api/src/features/products/products.routes.ts`, `packages/api/src/features/products/products.service.ts`, `packages/api/src/features/products/products.test.ts`
- Modify: `packages/api/src/app.ts`
- Delete (via `git mv`): `packages/api/src/routes/products.ts`, `packages/api/src/services/products.service.ts`, `packages/api/tests/products.test.ts`

**Interfaces:**

- Consumes: `../../shared/db/prisma.js` (exports `prisma`), `../../shared/errors.js` (exports `NotFoundError`) — both from Task 1.
- Produces: `./features/products/products.routes.js` default-exports an Express `Router`, consumed by `app.ts`.

- [ ] **Step 1: Move the three files with `git mv`**

Run from `packages/api/`:

```bash
mkdir -p src/features/products
git mv src/routes/products.ts src/features/products/products.routes.ts
git mv src/services/products.service.ts src/features/products/products.service.ts
git mv tests/products.test.ts src/features/products/products.test.ts
```

- [ ] **Step 2: Update `products.routes.ts`'s service import**

Replace the contents of `packages/api/src/features/products/products.routes.ts` with:

```ts
import { Router } from "express";
import { ProductListQuerySchema } from "@marketplace/core";
import { listProducts, getProductById } from "./products.service.js";

const router = Router();

router.get("/", async (req, res, next) => {
  try {
    const parsed = ProductListQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      res
        .status(400)
        .json({ error: parsed.error.errors[0].message, code: "INVALID_INPUT" });
      return;
    }

    const result = await listProducts(parsed.data);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.get("/:id", async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      res.status(404).json({ error: "Product not found", code: "NOT_FOUND" });
      return;
    }

    const product = await getProductById(id);
    res.json(product);
  } catch (err) {
    next(err);
  }
});

export default router;
```

- [ ] **Step 3: Update `products.service.ts`'s shared imports**

Replace lines 1-2 of `packages/api/src/features/products/products.service.ts` with:

```ts
import { prisma } from "../../shared/db/prisma.js";
import { NotFoundError } from "../../shared/errors.js";
```

(Rest of the file — the `ProductDTO` type, `PAGE_SIZE`, `listProducts`, `getProductById` — stays exactly as it was; only the two import paths change.)

- [ ] **Step 4: Update `products.test.ts`'s app/prisma imports**

Replace lines 1-4 of `packages/api/src/features/products/products.test.ts` with:

```ts
import { describe, it, expect, beforeEach, afterAll } from "vitest";
import request from "supertest";
import { app } from "../../app.js";
import { prisma } from "../../shared/db/prisma.js";
```

(Rest of the test file's `describe`/`it` blocks stay exactly as they were.)

- [ ] **Step 5: Update `app.ts`'s products import**

In `packages/api/src/app.ts`, change:

```ts
import productsRouter from "./routes/products.js";
```

to:

```ts
import productsRouter from "./features/products/products.routes.js";
```

- [ ] **Step 6: Run the full API test suite and confirm it passes**

Run from the repo root: `bun run test:api`
Expected: All tests pass, including the relocated `src/features/products/products.test.ts`.

- [ ] **Step 7: Commit**

```bash
git add -A packages/api/src packages/api/tests
git commit -m "Move products feature into src/features/products/"
```

---

### Task 3: Move the `cart` feature into `src/features/cart/`

**Files:**

- Create (via `git mv`): `packages/api/src/features/cart/cart.routes.ts`, `packages/api/src/features/cart/cart.service.ts`, `packages/api/src/features/cart/cart.test.ts`
- Modify: `packages/api/src/app.ts`
- Delete (via `git mv`): `packages/api/src/routes/cart.ts`, `packages/api/src/services/cart.service.ts`, `packages/api/tests/cart.test.ts`

**Interfaces:**

- Consumes: `../../shared/db/prisma.js` (exports `prisma`), `../../shared/errors.js` (exports `NotFoundError`) — both from Task 1.
- Produces: `./features/cart/cart.routes.js` default-exports an Express `Router`, consumed by `app.ts`.

- [ ] **Step 1: Move the three files with `git mv`**

Run from `packages/api/`:

```bash
mkdir -p src/features/cart
git mv src/routes/cart.ts src/features/cart/cart.routes.ts
git mv src/services/cart.service.ts src/features/cart/cart.service.ts
git mv tests/cart.test.ts src/features/cart/cart.test.ts
```

- [ ] **Step 2: Update `cart.routes.ts`'s service import**

Replace lines 1-8 of `packages/api/src/features/cart/cart.routes.ts` with:

```ts
import { Router } from "express";
import { AddToCartSchema, UpdateCartItemSchema } from "@marketplace/core";
import {
  findCartById,
  addProductToCart,
  updateCartItemQuantity,
  removeCartItem,
} from "./cart.service.js";
```

(Rest of the file — the route handlers — stays exactly as it was.)

- [ ] **Step 3: Update `cart.service.ts`'s shared imports**

Replace lines 1-3 of `packages/api/src/features/cart/cart.service.ts` with:

```ts
import type { Prisma } from "@prisma/client";
import { prisma } from "../../shared/db/prisma.js";
import { NotFoundError } from "../../shared/errors.js";
```

(Rest of the file — `cartInclude`, `formatCart`, `findCartById`, `addProductToCart`, `updateCartItemQuantity`, `removeCartItem` — stays exactly as it was.)

- [ ] **Step 4: Update `cart.test.ts`'s app/prisma imports**

Replace lines 1-4 of `packages/api/src/features/cart/cart.test.ts` with:

```ts
import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { agent } from "supertest";
import { app } from "../../app.js";
import { prisma } from "../../shared/db/prisma.js";
```

(Rest of the test file stays exactly as it was.)

- [ ] **Step 5: Update `app.ts`'s cart import**

In `packages/api/src/app.ts`, change:

```ts
import cartRouter from "./routes/cart.js";
```

to:

```ts
import cartRouter from "./features/cart/cart.routes.js";
```

- [ ] **Step 6: Run the full API test suite and confirm it passes**

Run from the repo root: `bun run test:api`
Expected: All tests pass, including the relocated `src/features/cart/cart.test.ts`.

- [ ] **Step 7: Commit**

```bash
git add -A packages/api/src packages/api/tests
git commit -m "Move cart feature into src/features/cart/"
```

---

### Task 4: Move the `checkout` feature into `src/features/checkout/`

**Files:**

- Create (via `git mv`): `packages/api/src/features/checkout/checkout.routes.ts`, `packages/api/src/features/checkout/checkout.service.ts`
- Modify: `packages/api/src/app.ts`
- Delete (via `git mv`): `packages/api/src/routes/checkout.ts`, `packages/api/src/services/checkout.service.ts`

**Interfaces:**

- Consumes: `../../shared/errors.js` (exports `ForbiddenError`, `NotFoundError`), `../../shared/db/prisma.js` (exports `prisma`), `../../shared/stripe.js` (exports `stripe`) — all from Task 1.
- Produces: `./features/checkout/checkout.routes.js` default-exports an Express `Router`, consumed by `app.ts`.

There is no `checkout.test.ts` to move — checkout has no dedicated test file today (its behavior is exercised via `POST /checkout/payment-intent` cases inside `orders.test.ts`, which moves in Task 5).

- [ ] **Step 1: Move the two files with `git mv`**

Run from `packages/api/`:

```bash
mkdir -p src/features/checkout
git mv src/routes/checkout.ts src/features/checkout/checkout.routes.ts
git mv src/services/checkout.service.ts src/features/checkout/checkout.service.ts
```

- [ ] **Step 2: Update `checkout.routes.ts`'s imports**

Replace lines 1-3 of `packages/api/src/features/checkout/checkout.routes.ts` with:

```ts
import { Router } from "express";
import { ForbiddenError } from "../../shared/errors.js";
import { createPaymentIntent } from "./checkout.service.js";
```

(Rest of the file — the route handler — stays exactly as it was.)

- [ ] **Step 3: Update `checkout.service.ts`'s shared imports**

Replace lines 1-3 of `packages/api/src/features/checkout/checkout.service.ts` with:

```ts
import { prisma } from "../../shared/db/prisma.js";
import { NotFoundError } from "../../shared/errors.js";
import { stripe } from "../../shared/stripe.js";
```

(Rest of the file — `createPaymentIntent` — stays exactly as it was.)

- [ ] **Step 4: Update `app.ts`'s checkout import**

In `packages/api/src/app.ts`, change:

```ts
import checkoutRouter from "./routes/checkout.js";
```

to:

```ts
import checkoutRouter from "./features/checkout/checkout.routes.js";
```

- [ ] **Step 5: Run the full API test suite and confirm it passes**

Run from the repo root: `bun run test:api`
Expected: All tests pass — checkout is exercised by the `POST /checkout/payment-intent` cases in `tests/orders.test.ts` (not yet moved; that happens in Task 5), which still import `app` from its unchanged location at this point.

- [ ] **Step 6: Commit**

```bash
git add -A packages/api/src
git commit -m "Move checkout feature into src/features/checkout/"
```

---

### Task 5: Move the `orders` feature into `src/features/orders/`

**Files:**

- Create (via `git mv`): `packages/api/src/features/orders/orders.routes.ts`, `packages/api/src/features/orders/orders.service.ts`, `packages/api/src/features/orders/orders.test.ts`
- Modify: `packages/api/src/app.ts`
- Delete (via `git mv`): `packages/api/src/routes/orders.ts`, `packages/api/src/services/orders.service.ts`, `packages/api/tests/orders.test.ts`

**Interfaces:**

- Consumes: `../../shared/errors.js` (exports `NotFoundError`, `PaymentFailedError`, `ForbiddenError`), `../../shared/db/prisma.js` (exports `prisma`), `../../shared/stripe.js` (exports `stripe`) — all from Task 1.
- Produces: `./features/orders/orders.routes.js` default-exports an Express `Router`, consumed by `app.ts`.

- [ ] **Step 1: Move the three files with `git mv`**

Run from `packages/api/`:

```bash
mkdir -p src/features/orders
git mv src/routes/orders.ts src/features/orders/orders.routes.ts
git mv src/services/orders.service.ts src/features/orders/orders.service.ts
git mv tests/orders.test.ts src/features/orders/orders.test.ts
```

- [ ] **Step 2: Update `orders.routes.ts`'s imports**

Replace lines 1-4 of `packages/api/src/features/orders/orders.routes.ts` with:

```ts
import { Router } from "express";
import { PlaceOrderSchema } from "@marketplace/core";
import { ForbiddenError } from "../../shared/errors.js";
import { placeOrder, getOrderById } from "./orders.service.js";
```

(Rest of the file — the route handlers — stays exactly as it was.)

- [ ] **Step 3: Update `orders.service.ts`'s shared imports**

Replace lines 1-6 of `packages/api/src/features/orders/orders.service.ts` with:

```ts
import type Stripe from "stripe";
import type { Prisma } from "@prisma/client";
import type { AddressInput } from "@marketplace/core";
import { prisma } from "../../shared/db/prisma.js";
import { NotFoundError, PaymentFailedError } from "../../shared/errors.js";
import { stripe } from "../../shared/stripe.js";
```

(Rest of the file — `formatOrder`, `placeOrder`, `getOrderById` — stays exactly as it was.)

- [ ] **Step 4: Update `orders.test.ts`'s app/prisma imports**

Replace lines 1-5 of `packages/api/src/features/orders/orders.test.ts` with:

```ts
import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { agent } from "supertest";
import Stripe from "stripe";
import { app } from "../../app.js";
import { prisma } from "../../shared/db/prisma.js";
```

(Rest of the test file — including the `POST /checkout/payment-intent` cases at the bottom, which exercise the Task 4 checkout feature end-to-end through `app` — stays exactly as it was.)

- [ ] **Step 5: Update `app.ts`'s orders import**

In `packages/api/src/app.ts`, change:

```ts
import ordersRouter from "./routes/orders.js";
```

to:

```ts
import ordersRouter from "./features/orders/orders.routes.js";
```

- [ ] **Step 6: Confirm the old `routes/` and `services/` folders are now empty and remove them**

```bash
ls packages/api/src/routes packages/api/src/services
```

Expected: both commands report the directory doesn't exist or is empty (all four route files and four service files have been moved across Tasks 2-5). If either directory still contains files, stop — a move was missed.

```bash
rmdir packages/api/src/routes packages/api/src/services 2>/dev/null || true
```

- [ ] **Step 7: Run the full API test suite and confirm it passes**

Run from the repo root: `bun run test:api`
Expected: All tests pass, including the relocated `src/features/orders/orders.test.ts`. This is the last feature move, so this run is the final proof that every route, service, and test works from its new `src/features/*` / `src/shared/*` location.

- [ ] **Step 8: Commit**

```bash
git add -A packages/api/src packages/api/tests
git commit -m "Move orders feature into src/features/orders/"
```

---

### Task 6: Update ADR 004 and do a final full verification

**Files:**

- Modify: `docs/adr/004-api-architecture.md`

**Interfaces:** None — this is a documentation-only task plus a final build/test check.

- [ ] **Step 1: Read the current ADR**

Read `docs/adr/004-api-architecture.md` in full (31 lines) to see the exact wording being amended.

- [ ] **Step 2: Amend the "Routes → Services layering" section's file-path references**

In `docs/adr/004-api-architecture.md`, replace this sentence in the "Routes → Services layering" section:

```
Business logic lives in `src/services/*.service.ts`, one per resource, plus a shared `src/services/stripe.ts` client.
```

with:

```
Business logic lives in `src/features/<name>/<name>.service.ts`, one per resource (`products`, `cart`, `checkout`, `orders`), colocated with its route file (`<name>.routes.ts`) and test (`<name>.test.ts`) in `src/features/<name>/`. Cross-cutting code — `errors.ts`, the Prisma client, session/error middleware, the shared Stripe client, and session types — lives in `src/shared/`. This feature-based layout replaced the earlier flat `src/routes/` + `src/services/` split on 2026-07-06; see `docs/superpowers/specs/2026-07-06-api-feature-based-restructure-design.md` for the restructuring rationale. The routes-thin/services-hold-logic decision below is unchanged.
```

- [ ] **Step 3: Amend the "Consequences" section's file-path reference**

In `docs/adr/004-api-architecture.md`, replace:

```
The existing `packages/api/tests/*.test.ts` supertest suite asserts on exact response bodies and status codes; any change to this layering must keep those responses byte-identical or update the tests deliberately.
```

with:

```
The existing supertest suite (now colocated as `packages/api/src/features/*/*.test.ts` and `packages/api/src/shared/middleware/error.test.ts`) asserts on exact response bodies and status codes; any change to this layering must keep those responses byte-identical or update the tests deliberately.
```

- [ ] **Step 4: Run the full test suite and a type-check build one final time**

Run from the repo root: `bun run test:api`
Expected: All tests pass.

Run from `packages/api/`: `bun run build`
Expected: `tsc` completes with no errors, confirming every import path across the new `src/features/` and `src/shared/` tree resolves correctly.

- [ ] **Step 5: Commit**

```bash
git add docs/adr/004-api-architecture.md
git commit -m "Update ADR 004 for feature-based API folder structure"
```
