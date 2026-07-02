# API Routes → Services Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extract business logic (Prisma queries, Stripe calls, calculations, response formatting) out of `packages/api/src/routes/*.ts` into a new `packages/api/src/services/` layer, leaving routes responsible only for parsing input and shaping HTTP responses.

**Architecture:** One service file per route domain (`cart.service.ts`, `checkout.service.ts`, `orders.service.ts`, `products.service.ts`), all exporting plain async functions (no classes). A shared `AppError` hierarchy (`src/errors.ts`) lets services throw typed errors (`NotFoundError`, `ForbiddenError`, `PaymentFailedError`) that a small addition to the existing Express error middleware turns into the exact same `{ error, code }` JSON responses the routes produce today. Routes keep their existing `try { ... } catch (err) { next(err) }` wrapping unchanged.

**Tech Stack:** TypeScript, Express 5, Prisma 7, Stripe, Vitest + supertest (existing integration-style tests hitting a real Postgres test DB — see `packages/api/vitest.config.ts` / `.env.test`).

## Global Constraints

- Response bodies, HTTP status codes, and `code` values must stay byte-identical to current behavior — the existing test suite (`packages/api/tests/cart.test.ts`, `orders.test.ts`, `products.test.ts`) asserts on them and must keep passing unmodified.
- No change to route paths or request shapes.
- No class-based services — plain exported async functions only.
- Input validation (Zod `safeParse`, `parseInt` param parsing) stays in routes; business logic (DB, Stripe, calculations, formatting) moves to services.
- The cart-ownership session check (`cartId !== req.session.cartId`) stays in routes (no DB access involved).
- Do not modify existing test files.
- Full spec: `docs/superpowers/specs/2026-07-02-api-routes-services-design.md`.

---

### Task 1: Typed errors + error middleware

**Files:**

- Create: `packages/api/src/errors.ts`
- Modify: `packages/api/src/middleware/error.ts`
- Test: `packages/api/tests/error-handler.test.ts` (new)

**Interfaces:**

- Produces: `AppError` (base class, `message`, `statusCode: number`, `code: string`), `NotFoundError` (404 / `"NOT_FOUND"`), `ForbiddenError` (403 / `"FORBIDDEN"`), `PaymentFailedError(message, statusCode = 400)` (code always `"PAYMENT_FAILED"`) — all from `packages/api/src/errors.ts`. All later tasks import these.

- [ ] **Step 1: Write the failing test**

Create `packages/api/tests/error-handler.test.ts`:

```ts
import { describe, it, expect, vi } from "vitest";
import { errorHandler } from "../src/middleware/error.js";
import { NotFoundError } from "../src/errors.js";

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

- [ ] **Step 2: Run the test to verify it fails**

Run: `bun run test:api` (from repo root)
Expected: FAIL — `packages/api/src/errors.ts` does not exist yet, so the import errors out.

- [ ] **Step 3: Create `packages/api/src/errors.ts`**

```ts
export class AppError extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public code: string,
  ) {
    super(message);
    this.name = "AppError";
  }
}

export class NotFoundError extends AppError {
  constructor(message = "Not found") {
    super(message, 404, "NOT_FOUND");
    this.name = "NotFoundError";
  }
}

export class ForbiddenError extends AppError {
  constructor(message = "Forbidden") {
    super(message, 403, "FORBIDDEN");
    this.name = "ForbiddenError";
  }
}

export class PaymentFailedError extends AppError {
  constructor(message: string, statusCode = 400) {
    super(message, statusCode, "PAYMENT_FAILED");
    this.name = "PaymentFailedError";
  }
}
```

- [ ] **Step 4: Update `packages/api/src/middleware/error.ts`**

Replace the full file contents with:

```ts
import type { Request, Response, NextFunction } from "express";
import { AppError } from "../errors.js";

export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction,
) {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({ error: err.message, code: err.code });
    return;
  }

  console.error(err);
  res
    .status(500)
    .json({ error: "Internal server error", code: "INTERNAL_ERROR" });
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `bun run test:api`
Expected: `Test Files 4 passed (4)`, `Tests 26 passed (26)` (24 pre-existing + 2 new).

- [ ] **Step 6: Commit**

```bash
git add packages/api/src/errors.ts packages/api/src/middleware/error.ts packages/api/tests/error-handler.test.ts
git commit -m "feat(api): add typed AppError hierarchy and wire into error middleware"
```

---

### Task 2: `products.service.ts` + refactor `routes/products.ts`

**Files:**

- Create: `packages/api/src/services/products.service.ts`
- Modify: `packages/api/src/routes/products.ts` (full rewrite)
- Test: `packages/api/tests/products.test.ts` (existing, unmodified — must keep passing)

**Interfaces:**

- Consumes: `NotFoundError` from `../errors.js` (Task 1).
- Produces: `listProducts(): Promise<ProductDTO[]>`, `getProductById(id: number): Promise<ProductDTO & { description, image_urls, ... }>` from `packages/api/src/services/products.service.ts`. No later task depends on these types.

- [ ] **Step 1: Confirm current test baseline**

Run: `bun run test:api`
Expected: `Tests 26 passed (26)` (from Task 1).

- [ ] **Step 2: Create `packages/api/src/services/products.service.ts`**

```ts
import { prisma } from "../db/prisma.js";
import { NotFoundError } from "../errors.js";

export type ProductDTO = {
  id: number;
  name: string;
  primary_image: string;
  unit_price: number;
  currency: string;
};

export async function listProducts(): Promise<ProductDTO[]> {
  const products = await prisma.product.findMany({
    select: {
      id: true,
      name: true,
      primary_image: true,
      unit_price: true,
      currency: true,
    },
  });

  return products.map((p) => ({ ...p, unit_price: Number(p.unit_price) }));
}

export async function getProductById(id: number) {
  const product = await prisma.product.findUnique({ where: { id } });

  if (!product) {
    throw new NotFoundError("Product not found");
  }

  return { ...product, unit_price: Number(product.unit_price) };
}
```

- [ ] **Step 3: Rewrite `packages/api/src/routes/products.ts`**

```ts
import { Router } from "express";
import { listProducts, getProductById } from "../services/products.service.js";

const router = Router();

router.get("/", async (_req, res, next) => {
  try {
    const results = await listProducts();
    res.json({ results });
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

- [ ] **Step 4: Run tests to verify no regression**

Run: `bun run test:api`
Expected: `Tests 26 passed (26)` — identical count to Step 1, `products.test.ts` cases (`GET /products`, `GET /products/:id` including the 404 case) all still pass unmodified.

- [ ] **Step 5: Commit**

```bash
git add packages/api/src/services/products.service.ts packages/api/src/routes/products.ts
git commit -m "refactor(api): extract product logic into products.service.ts"
```

---

### Task 3: `cart.service.ts` + refactor `routes/cart.ts`

**Files:**

- Create: `packages/api/src/services/cart.service.ts`
- Modify: `packages/api/src/routes/cart.ts` (full rewrite)
- Test: `packages/api/tests/cart.test.ts` (existing, unmodified — must keep passing)

**Interfaces:**

- Consumes: `NotFoundError` from `../errors.js` (Task 1).
- Produces: `CartDTO` type, `findCartById(cartId: number): Promise<CartDTO | null>`, `addProductToCart(cartId: number | null, sessionId: string, productId: number, quantity: number): Promise<{ cartId: number; cart: CartDTO }>`, `updateCartItemQuantity(cartId: number | null, productId: number, quantity: number): Promise<CartDTO>`, `removeCartItem(cartId: number | null, productId: number): Promise<CartDTO>` from `packages/api/src/services/cart.service.ts`. No later task depends on these.

- [ ] **Step 1: Confirm current test baseline**

Run: `bun run test:api`
Expected: `Tests 26 passed (26)`.

- [ ] **Step 2: Create `packages/api/src/services/cart.service.ts`**

```ts
import type { Prisma } from "@prisma/client";
import { prisma } from "../db/prisma.js";
import { NotFoundError } from "../errors.js";

type CartWithItems = Prisma.CartGetPayload<{
  include: { items: { include: { product: true } } };
}>;

const cartInclude = {
  items: { include: { product: true } },
} satisfies Prisma.CartInclude;

function formatCart(cart: CartWithItems) {
  const items = cart.items.map((item) => ({
    quantity: item.quantity,
    price: Number(item.product.unit_price) * item.quantity,
    currency: item.product.currency,
    product: {
      id: item.product.id,
      name: item.product.name,
      primary_image: item.product.primary_image,
    },
  }));

  return {
    id: cart.id,
    items,
    total_price: items.reduce((sum, item) => sum + item.price, 0),
    currency: "GBP",
  };
}

export type CartDTO = ReturnType<typeof formatCart>;

export async function findCartById(cartId: number): Promise<CartDTO | null> {
  const cart = await prisma.cart.findUnique({
    where: { id: cartId },
    include: cartInclude,
  });
  return cart ? formatCart(cart) : null;
}

export async function addProductToCart(
  cartId: number | null,
  sessionId: string,
  productId: number,
  quantity: number,
): Promise<{ cartId: number; cart: CartDTO }> {
  const product = await prisma.product.findUnique({
    where: { id: productId },
  });
  if (!product) {
    throw new NotFoundError("Product not found");
  }

  let resolvedCartId = cartId;
  if (resolvedCartId) {
    const existing = await prisma.cart.findUnique({
      where: { id: resolvedCartId },
    });
    if (!existing) resolvedCartId = null;
  }

  if (!resolvedCartId) {
    const created = await prisma.cart.create({
      data: { session_id: sessionId },
    });
    resolvedCartId = created.id;
  }

  await prisma.cartItem.upsert({
    where: {
      cart_id_product_id: { cart_id: resolvedCartId, product_id: productId },
    },
    update: { quantity: { increment: quantity } },
    create: { cart_id: resolvedCartId, product_id: productId, quantity },
  });

  const updated = await prisma.cart.findUniqueOrThrow({
    where: { id: resolvedCartId },
    include: cartInclude,
  });

  return { cartId: resolvedCartId, cart: formatCart(updated) };
}

export async function updateCartItemQuantity(
  cartId: number | null,
  productId: number,
  quantity: number,
): Promise<CartDTO> {
  if (!cartId) {
    throw new NotFoundError("Cart not found");
  }

  const cartItem = await prisma.cartItem.findUnique({
    where: { cart_id_product_id: { cart_id: cartId, product_id: productId } },
  });

  if (!cartItem) {
    throw new NotFoundError("Item not in cart");
  }

  if (quantity === 0) {
    await prisma.cartItem.delete({
      where: { cart_id_product_id: { cart_id: cartId, product_id: productId } },
    });
  } else {
    await prisma.cartItem.update({
      where: { cart_id_product_id: { cart_id: cartId, product_id: productId } },
      data: { quantity },
    });
  }

  const cart = await prisma.cart.findUniqueOrThrow({
    where: { id: cartId },
    include: cartInclude,
  });

  return formatCart(cart);
}

export async function removeCartItem(
  cartId: number | null,
  productId: number,
): Promise<CartDTO> {
  if (!cartId) {
    throw new NotFoundError("Cart not found");
  }

  await prisma.cartItem.deleteMany({
    where: { cart_id: cartId, product_id: productId },
  });

  const cart = await prisma.cart.findUniqueOrThrow({
    where: { id: cartId },
    include: cartInclude,
  });

  return formatCart(cart);
}
```

- [ ] **Step 3: Rewrite `packages/api/src/routes/cart.ts`**

```ts
import { Router } from "express";
import { AddToCartSchema, UpdateCartItemSchema } from "@marketplace/core";
import {
  findCartById,
  addProductToCart,
  updateCartItemQuantity,
  removeCartItem,
} from "../services/cart.service.js";

const router = Router();

const EMPTY_CART = { id: null, items: [], total_price: 0, currency: "GBP" };

router.get("/", async (req, res, next) => {
  try {
    if (!req.session.cartId) {
      res.json(EMPTY_CART);
      return;
    }

    const cart = await findCartById(req.session.cartId);

    if (!cart) {
      req.session.cartId = undefined;
      res.json(EMPTY_CART);
      return;
    }

    res.json(cart);
  } catch (err) {
    next(err);
  }
});

router.post("/products", async (req, res, next) => {
  try {
    const parsed = AddToCartSchema.safeParse(req.body);
    if (!parsed.success) {
      res
        .status(400)
        .json({ error: parsed.error.errors[0].message, code: "INVALID_INPUT" });
      return;
    }
    const { productId, quantity } = parsed.data;

    const result = await addProductToCart(
      req.session.cartId ?? null,
      req.session.id,
      productId,
      quantity,
    );

    req.session.cartId = result.cartId;
    res.json(result.cart);
  } catch (err) {
    next(err);
  }
});

router.put("/products/:productId", async (req, res, next) => {
  try {
    const productId = parseInt(req.params.productId, 10);
    const parsed = UpdateCartItemSchema.safeParse(req.body);

    if (isNaN(productId) || !parsed.success) {
      res.status(400).json({
        error: parsed.success
          ? "Invalid productId"
          : parsed.error.errors[0].message,
        code: "INVALID_INPUT",
      });
      return;
    }

    const cart = await updateCartItemQuantity(
      req.session.cartId ?? null,
      productId,
      parsed.data.quantity,
    );

    res.json(cart);
  } catch (err) {
    next(err);
  }
});

router.delete("/products/:productId", async (req, res, next) => {
  try {
    const productId = parseInt(req.params.productId, 10);

    if (isNaN(productId)) {
      res
        .status(400)
        .json({ error: "Invalid productId", code: "INVALID_INPUT" });
      return;
    }

    const cart = await removeCartItem(req.session.cartId ?? null, productId);
    res.json(cart);
  } catch (err) {
    next(err);
  }
});

export default router;
```

- [ ] **Step 4: Run tests to verify no regression**

Run: `bun run test:api`
Expected: `Tests 26 passed (26)` — identical count to Step 1, all `cart.test.ts` cases (create, increment, 400s, PUT quantity update/removal, DELETE, 404s) still pass unmodified.

- [ ] **Step 5: Commit**

```bash
git add packages/api/src/services/cart.service.ts packages/api/src/routes/cart.ts
git commit -m "refactor(api): extract cart logic into cart.service.ts"
```

---

### Task 4: Shared Stripe client + `checkout.service.ts` + refactor `routes/checkout.ts`

**Files:**

- Create: `packages/api/src/services/stripe.ts`
- Create: `packages/api/src/services/checkout.service.ts`
- Modify: `packages/api/src/routes/checkout.ts` (full rewrite)

**Interfaces:**

- Consumes: `NotFoundError`, `ForbiddenError` from `../errors.js` (Task 1).
- Produces: `stripe` (shared `Stripe` client instance) from `packages/api/src/services/stripe.ts` — consumed by Task 5. `createPaymentIntent(cartId: number): Promise<{ clientSecret: string; amount: number }>` from `packages/api/src/services/checkout.service.ts` — no later task depends on it.

**Note:** `packages/api/tests/` has no `checkout.test.ts` today (pre-existing gap, not introduced by this refactor — Stripe calls need live/test API credentials the current suite doesn't exercise). Verification for this task is therefore: the full existing suite stays green (no regression in the other three domains) and `tsc` typechecks cleanly. Do not add a new checkout test file — that would be scope creep beyond this refactor.

- [ ] **Step 1: Confirm current test baseline**

Run: `bun run test:api`
Expected: `Tests 26 passed (26)`.

- [ ] **Step 2: Create `packages/api/src/services/stripe.ts`**

```ts
import Stripe from "stripe";

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2026-06-24.dahlia",
});
```

- [ ] **Step 3: Create `packages/api/src/services/checkout.service.ts`**

```ts
import { prisma } from "../db/prisma.js";
import { NotFoundError } from "../errors.js";
import { stripe } from "./stripe.js";

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

- [ ] **Step 4: Rewrite `packages/api/src/routes/checkout.ts`**

```ts
import { Router } from "express";
import { ForbiddenError } from "../errors.js";
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

- [ ] **Step 5: Typecheck and run tests to verify no regression**

Run: `cd packages/api && bun run build && cd ../.. && bun run test:api`
Expected: `tsc` build succeeds with no errors; `Tests 26 passed (26)` — identical count to Step 1 (checkout has no automated coverage to regress).

- [ ] **Step 6: Commit**

```bash
git add packages/api/src/services/stripe.ts packages/api/src/services/checkout.service.ts packages/api/src/routes/checkout.ts
git commit -m "refactor(api): extract checkout logic into checkout.service.ts, share Stripe client"
```

---

### Task 5: `orders.service.ts` + refactor `routes/orders.ts`

**Files:**

- Create: `packages/api/src/services/orders.service.ts`
- Modify: `packages/api/src/routes/orders.ts` (full rewrite)
- Test: `packages/api/tests/orders.test.ts` (existing, unmodified — must keep passing)

**Interfaces:**

- Consumes: `NotFoundError`, `ForbiddenError`, `PaymentFailedError` from `../errors.js` (Task 1); `stripe` from `../services/stripe.js` (Task 4); `AddressInput` type from `@marketplace/core`.
- Produces: `OrderDTO` type, `placeOrder(params: { cartId: number; paymentIntentId: string; addressDetails: AddressInput }): Promise<OrderDTO>`, `getOrderById(id: number): Promise<OrderDTO>` from `packages/api/src/services/orders.service.ts`. No later task depends on these.

- [ ] **Step 1: Confirm current test baseline**

Run: `bun run test:api`
Expected: `Tests 26 passed (26)`.

- [ ] **Step 2: Create `packages/api/src/services/orders.service.ts`**

```ts
import type Stripe from "stripe";
import type { Prisma } from "@prisma/client";
import type { AddressInput } from "@marketplace/core";
import { prisma } from "../db/prisma.js";
import { NotFoundError, PaymentFailedError } from "../errors.js";
import { stripe } from "./stripe.js";

type OrderWithItems = Prisma.OrderGetPayload<{
  include: { items: { include: { product: true } } };
}>;

const orderInclude = {
  items: { include: { product: true } },
} satisfies Prisma.OrderInclude;

function formatOrder(order: OrderWithItems) {
  return {
    id: order.id,
    total_price: Number(order.total_price),
    currency: order.currency,
    status: order.status,
    items: order.items.map((item) => ({
      quantity: item.quantity,
      price: Number(item.price),
      currency: item.product.currency,
      product: {
        id: item.product.id,
        name: item.product.name,
        primary_image: item.product.primary_image,
      },
    })),
    address_details: {
      name: order.address_name,
      street: order.address_street,
      city: order.address_city,
      postcode: order.address_postcode,
    },
    payment_details: {
      card_last_four_digits: order.card_last_four,
    },
  };
}

export type OrderDTO = ReturnType<typeof formatOrder>;

export async function placeOrder(params: {
  cartId: number;
  paymentIntentId: string;
  addressDetails: AddressInput;
}): Promise<OrderDTO> {
  const { cartId, paymentIntentId, addressDetails } = params;

  let paymentIntent: Stripe.PaymentIntent;
  try {
    paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId, {
      expand: ["payment_method"],
    });
  } catch {
    throw new PaymentFailedError("Invalid payment intent");
  }

  if (paymentIntent.status !== "succeeded") {
    throw new PaymentFailedError("Payment not completed");
  }

  const cart = await prisma.cart.findUnique({
    where: { id: cartId },
    include: { items: { include: { product: true } } },
  });

  if (!cart || cart.items.length === 0) {
    throw new NotFoundError("Cart not found or empty");
  }

  const orderItems = cart.items.map((item) => ({
    product_id: item.product_id,
    quantity: item.quantity,
    price: Number(item.product.unit_price) * item.quantity,
  }));

  const totalPrice = orderItems.reduce((sum, item) => sum + item.price, 0);

  const pm = paymentIntent.payment_method;

  if (!pm || typeof pm !== "object" || pm.type !== "card" || !pm.card?.last4) {
    console.error(
      "[placeOrder] ALERT: Stripe PaymentIntent succeeded but card last4 is unreadable. " +
        `paymentIntentId=${paymentIntentId} cartId=${cartId} pm_type=${typeof pm === "object" && pm !== null ? (pm as Stripe.PaymentMethod).type : typeof pm}. ` +
        "Customer has been charged but no order was created. Manual reconciliation required.",
    );
    throw new PaymentFailedError(
      "Could not read card details from payment",
      500,
    );
  }

  const cardLastFour = pm.card.last4;

  // Use a transaction so order creation and cart deletion are atomic.
  // If the process crashes between these two steps, we'd otherwise end
  // up with a dangling order and a cart that can be re-ordered.
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
        items: { create: orderItems },
      },
      include: orderInclude,
    });
    await tx.cart.delete({ where: { id: cartId } });
    return created;
  });

  return formatOrder(order);
}

export async function getOrderById(id: number): Promise<OrderDTO> {
  const order = await prisma.order.findUnique({
    where: { id },
    include: orderInclude,
  });

  if (!order) {
    throw new NotFoundError("Order not found");
  }

  return formatOrder(order);
}
```

- [ ] **Step 3: Rewrite `packages/api/src/routes/orders.ts`**

```ts
import { Router } from "express";
import { PlaceOrderSchema } from "@marketplace/core";
import { ForbiddenError } from "../errors.js";
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

- [ ] **Step 4: Run tests to verify no regression**

Run: `bun run test:api`
Expected: `Tests 26 passed (26)` — identical count to Step 1, all `orders.test.ts` cases still pass unmodified.

- [ ] **Step 5: Commit**

```bash
git add packages/api/src/services/orders.service.ts packages/api/src/routes/orders.ts
git commit -m "refactor(api): extract order logic into orders.service.ts, dedupe order formatting"
```

---

### Task 6: Final verification

**Files:** none (verification only).

**Interfaces:** none.

- [ ] **Step 1: Typecheck the whole api package**

Run: `cd packages/api && bun run build`
Expected: exits 0, no TypeScript errors.

- [ ] **Step 2: Run the full api test suite**

Run: `bun run test:api` (from repo root)
Expected: `Test Files 4 passed (4)`, `Tests 26 passed (26)`.

- [ ] **Step 3: Confirm no dangling references to removed route-level exports**

Run: `grep -rn "formatCart\|cartInclude\|formatOrder" packages/api/src/routes packages/api/tests`
Expected: no matches — these helpers now live only inside their respective `services/*.service.ts` files and are not imported anywhere else.

- [ ] **Step 4: Confirm every route file only imports its matching service (no leftover direct `prisma`/`stripe` imports)**

Run: `grep -rn "from \"../db/prisma.js\"\|from \"stripe\"" packages/api/src/routes`
Expected: no matches — all Prisma/Stripe access now goes through `services/`.

This task produces no commit — it's a verification-only checkpoint confirming Tasks 1–5 left the codebase in a consistent, fully-migrated state.
