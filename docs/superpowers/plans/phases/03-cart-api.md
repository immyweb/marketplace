> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Phase 3 — Cart API** | [link to overview](../2026-06-30-marketplace.md)

**Global Constraints:** See [overview](../2026-06-30-marketplace.md#global-constraints) — all constraints apply here.

---

## Phase 3 — Cart API

### Task 9: Cart Routes Setup + GET /cart

**Files:**

- Create: `packages/api/src/routes/cart.ts`
- Create: `packages/api/tests/cart.test.ts`

**Interfaces:**

- Produces: `GET /cart` → `Cart` object (empty cart if no session cart exists)
- Produces: `formatCart(cart)` — internal helper used by all cart routes

```typescript
// Cart response shape
interface CartResponse {
  id: number | null;
  items: Array<{
    quantity: number;
    price: number; // unit_price * quantity, computed at query time
    currency: string;
    product: { id: number; name: string; primary_image: string };
  }>;
  total_price: number;
  currency: string;
}
```

- [ ] **Step 1: Write the failing test**

Create `packages/api/tests/cart.test.ts`:

```typescript
import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { agent } from "supertest";
import { app } from "../src/app.js";
import { prisma } from "../src/db/prisma.js";

beforeEach(async () => {
  await prisma.cartItem.deleteMany();
  await prisma.cart.deleteMany();
});

afterAll(async () => {
  await prisma.cartItem.deleteMany();
  await prisma.cart.deleteMany();
  await prisma.product.deleteMany();
});

describe("GET /cart", () => {
  it("returns an empty cart when no cart exists for the session", async () => {
    const res = await agent(app).get("/cart").expect(200);
    expect(res.body).toEqual({
      id: null,
      items: [],
      total_price: 0,
      currency: "GBP",
    });
  });
});
```

- [ ] **Step 2: Run test to confirm it fails**

```bash
bun run --filter api test -- --reporter=verbose
```

Expected: FAIL — `Cannot find module '../src/routes/cart.js'`

- [ ] **Step 3: Create `packages/api/src/routes/cart.ts`**

```typescript
import { Router } from "express";
import { prisma } from "../db/prisma.js";
import type { Prisma } from "@prisma/client";

const router = Router();

type CartWithItems = Prisma.CartGetPayload<{
  include: { items: { include: { product: true } } };
}>;

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

const cartInclude = {
  items: { include: { product: true } },
} satisfies Prisma.CartInclude;

router.get("/", async (req, res, next) => {
  try {
    if (!req.session.cartId) {
      res.json({ id: null, items: [], total_price: 0, currency: "GBP" });
      return;
    }

    const cart = await prisma.cart.findUnique({
      where: { id: req.session.cartId },
      include: cartInclude,
    });

    if (!cart) {
      req.session.cartId = undefined;
      res.json({ id: null, items: [], total_price: 0, currency: "GBP" });
      return;
    }

    res.json(formatCart(cart));
  } catch (err) {
    next(err);
  }
});

export { formatCart, cartInclude };
export default router;
```

- [ ] **Step 4: Run test to confirm it passes**

```bash
bun run --filter api test -- --reporter=verbose
```

Expected: PASS ✓

- [ ] **Step 5: Commit**

```bash
git add packages/api/src/routes/cart.ts api/tests/cart.test.ts
git commit -m "feat: add GET /cart endpoint"
```

---

### Task 10: POST /cart/products

**Files:**

- Modify: `packages/api/src/routes/cart.ts`
- Modify: `packages/api/tests/cart.test.ts`

**Interfaces:**

- Produces: `POST /cart/products` with body `{ productId: number, quantity: number }` → `CartResponse`
- Sets `req.session.cartId` on first call (persisting the session and setting the cookie)

- [ ] **Step 1: Write the failing test**

Add to `packages/api/tests/cart.test.ts`, after creating a product in `beforeAll`:

```typescript
let productId: number;

// Add to the top of the file, before the describe blocks:
// In beforeEach, also seed one product (reuse across tests)

// Replace the existing beforeEach with:
beforeEach(async () => {
  await prisma.cartItem.deleteMany();
  await prisma.cart.deleteMany();
  await prisma.product.deleteMany();

  const product = await prisma.product.create({
    data: {
      name: "Test T-Shirt",
      description: "desc",
      primary_image: "img.jpg",
      image_urls: [],
      unit_price: 10.0,
      currency: "GBP",
    },
  });
  productId = product.id;
});

describe("POST /cart/products", () => {
  it("creates a cart and adds the product", async () => {
    const ag = agent(app);
    const res = await ag
      .post("/cart/products")
      .send({ productId, quantity: 2 })
      .expect(200);

    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0]).toMatchObject({
      quantity: 2,
      price: 20,
      currency: "GBP",
      product: { id: productId, name: "Test T-Shirt" },
    });
    expect(res.body.total_price).toBe(20);
  });

  it("increments quantity when the same product is added again", async () => {
    const ag = agent(app);
    await ag.post("/cart/products").send({ productId, quantity: 1 });
    const res = await ag
      .post("/cart/products")
      .send({ productId, quantity: 2 })
      .expect(200);

    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0].quantity).toBe(3);
  });

  it("returns 400 when productId is missing", async () => {
    const res = await agent(app)
      .post("/cart/products")
      .send({ quantity: 1 })
      .expect(400);
    expect(res.body).toMatchObject({ error: expect.any(String) });
  });

  it("returns 404 when product does not exist", async () => {
    const res = await agent(app)
      .post("/cart/products")
      .send({ productId: 999999, quantity: 1 })
      .expect(404);
    expect(res.body).toMatchObject({ error: expect.any(String) });
  });
});
```

- [ ] **Step 2: Run tests to confirm new tests fail**

```bash
bun run --filter api test -- --reporter=verbose
```

Expected: FAIL — `POST /cart/products` tests fail with 404

- [ ] **Step 3: Add `POST /cart/products` to `packages/api/src/routes/cart.ts`**

Add the import at the top of the file:

```typescript
import { AddToCartSchema } from "@marketplace/core";
```

Then the route:

```typescript
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

    const product = await prisma.product.findUnique({
      where: { id: productId },
    });
    if (!product) {
      res.status(404).json({ error: "Product not found", code: "NOT_FOUND" });
      return;
    }

    let cart;
    if (req.session.cartId) {
      cart = await prisma.cart.findUnique({
        where: { id: req.session.cartId },
      });
    }

    if (!cart) {
      cart = await prisma.cart.create({ data: { session_id: req.session.id } });
      req.session.cartId = cart.id;
    }

    await prisma.cartItem.upsert({
      where: {
        cart_id_product_id: { cart_id: cart.id, product_id: productId },
      },
      update: { quantity: { increment: quantity } },
      create: { cart_id: cart.id, product_id: productId, quantity },
    });

    const updated = await prisma.cart.findUniqueOrThrow({
      where: { id: cart.id },
      include: cartInclude,
    });

    res.json(formatCart(updated));
  } catch (err) {
    next(err);
  }
});
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
bun run --filter api test -- --reporter=verbose
```

Expected: PASS — all cart tests ✓

- [ ] **Step 5: Commit**

```bash
git add packages/api/src/routes/cart.ts api/tests/cart.test.ts
git commit -m "feat: add POST /cart/products — add item to cart"
```

---

### Task 11: PUT /cart/products/:productId

**Files:**

- Modify: `packages/api/src/routes/cart.ts`
- Modify: `packages/api/tests/cart.test.ts`

**Interfaces:**

- Produces: `PUT /cart/products/:productId` with body `{ quantity: number }` → `CartResponse`
- Setting quantity to 0 removes the item

- [ ] **Step 1: Write the failing test**

Add to `packages/api/tests/cart.test.ts`:

```typescript
describe("PUT /cart/products/:productId", () => {
  it("updates the quantity of an item", async () => {
    const ag = agent(app);
    await ag.post("/cart/products").send({ productId, quantity: 1 });
    const res = await ag
      .put(`/cart/products/${productId}`)
      .send({ quantity: 5 })
      .expect(200);

    expect(res.body.items[0].quantity).toBe(5);
    expect(res.body.total_price).toBe(50);
  });

  it("removes the item when quantity is set to 0", async () => {
    const ag = agent(app);
    await ag.post("/cart/products").send({ productId, quantity: 2 });
    const res = await ag
      .put(`/cart/products/${productId}`)
      .send({ quantity: 0 })
      .expect(200);

    expect(res.body.items).toHaveLength(0);
    expect(res.body.total_price).toBe(0);
  });

  it("returns 404 when no cart exists", async () => {
    await agent(app)
      .put(`/cart/products/${productId}`)
      .send({ quantity: 1 })
      .expect(404);
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
bun run --filter api test -- --reporter=verbose
```

Expected: FAIL

- [ ] **Step 3: Add route to `packages/api/src/routes/cart.ts`**

Add the import at the top of the file (alongside the `AddToCartSchema` import from Task 10):

```typescript
import { AddToCartSchema, UpdateCartItemSchema } from "@marketplace/core";
```

Then the route:

```typescript
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
    const { quantity } = parsed.data;

    if (!req.session.cartId) {
      res.status(404).json({ error: "Cart not found", code: "NOT_FOUND" });
      return;
    }

    const cartItem = await prisma.cartItem.findUnique({
      where: {
        cart_id_product_id: {
          cart_id: req.session.cartId,
          product_id: productId,
        },
      },
    });

    if (!cartItem) {
      res.status(404).json({ error: "Item not in cart", code: "NOT_FOUND" });
      return;
    }

    if (quantity === 0) {
      await prisma.cartItem.delete({
        where: {
          cart_id_product_id: {
            cart_id: req.session.cartId,
            product_id: productId,
          },
        },
      });
    } else {
      await prisma.cartItem.update({
        where: {
          cart_id_product_id: {
            cart_id: req.session.cartId,
            product_id: productId,
          },
        },
        data: { quantity },
      });
    }

    const cart = await prisma.cart.findUniqueOrThrow({
      where: { id: req.session.cartId },
      include: cartInclude,
    });

    res.json(formatCart(cart));
  } catch (err) {
    next(err);
  }
});
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
bun run --filter api test -- --reporter=verbose
```

Expected: PASS ✓

- [ ] **Step 5: Commit**

```bash
git add packages/api/src/routes/cart.ts api/tests/cart.test.ts
git commit -m "feat: add PUT /cart/products/:productId — update item quantity"
```

---

### Task 12: DELETE /cart/products/:productId

**Files:**

- Modify: `packages/api/src/routes/cart.ts`
- Modify: `packages/api/tests/cart.test.ts`

**Interfaces:**

- Produces: `DELETE /cart/products/:productId` → `CartResponse`

- [ ] **Step 1: Write the failing test**

Add to `packages/api/tests/cart.test.ts`:

```typescript
describe("DELETE /cart/products/:productId", () => {
  it("removes the item from the cart", async () => {
    const ag = agent(app);
    await ag.post("/cart/products").send({ productId, quantity: 2 });
    const res = await ag.delete(`/cart/products/${productId}`).expect(200);

    expect(res.body.items).toHaveLength(0);
    expect(res.body.total_price).toBe(0);
  });

  it("returns 404 when no cart exists", async () => {
    await agent(app).delete(`/cart/products/${productId}`).expect(404);
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
bun run --filter api test -- --reporter=verbose
```

Expected: FAIL

- [ ] **Step 3: Add route to `packages/api/src/routes/cart.ts`**

```typescript
router.delete("/products/:productId", async (req, res, next) => {
  try {
    const productId = parseInt(req.params.productId, 10);

    if (isNaN(productId)) {
      res
        .status(400)
        .json({ error: "Invalid productId", code: "INVALID_INPUT" });
      return;
    }

    if (!req.session.cartId) {
      res.status(404).json({ error: "Cart not found", code: "NOT_FOUND" });
      return;
    }

    await prisma.cartItem.deleteMany({
      where: { cart_id: req.session.cartId, product_id: productId },
    });

    const cart = await prisma.cart.findUniqueOrThrow({
      where: { id: req.session.cartId },
      include: cartInclude,
    });

    res.json(formatCart(cart));
  } catch (err) {
    next(err);
  }
});
```

- [ ] **Step 4: Run all tests to confirm they pass**

```bash
bun run --filter api test -- --reporter=verbose
```

Expected: PASS — all product and cart tests ✓

- [ ] **Step 5: Commit**

```bash
git add packages/api/src/routes/cart.ts api/tests/cart.test.ts
git commit -m "feat: add DELETE /cart/products/:productId — remove item from cart"
```
