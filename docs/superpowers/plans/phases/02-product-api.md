> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Phase 2 — Product API** | [link to overview](../2026-06-30-marketplace.md)

**Global Constraints:** See [overview](../2026-06-30-marketplace.md#global-constraints) — all constraints apply here.

---

## Phase 2 — Product API

### Task 7: GET /products Endpoint

**Files:**

- Create: `packages/api/src/routes/products.ts`
- Create: `packages/api/tests/products.test.ts`

**Interfaces:**

- Produces: `GET /products` → `{ results: Product[] }`
- Consumes: `prisma.product` (from Task 3)

- [ ] **Step 1: Write the failing test**

Create `packages/api/tests/products.test.ts`:

```typescript
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { app } from "../src/app.js";
import { prisma } from "../src/db/prisma.js";

let productId: number;

beforeAll(async () => {
  await prisma.orderItem.deleteMany();
  await prisma.order.deleteMany();
  await prisma.cartItem.deleteMany();
  await prisma.cart.deleteMany();
  await prisma.product.deleteMany();

  const product = await prisma.product.create({
    data: {
      name: "Test T-Shirt",
      description: "A test product",
      primary_image: "https://example.com/img.jpg",
      image_urls: ["https://example.com/img.jpg"],
      unit_price: 12.99,
      currency: "GBP",
    },
  });
  productId = product.id;
});

afterAll(async () => {
  await prisma.product.deleteMany();
});

describe("GET /products", () => {
  it("returns a results array with all products", async () => {
    const res = await request(app).get("/products").expect(200);
    expect(res.body.results).toHaveLength(1);
    expect(res.body.results[0]).toMatchObject({
      id: productId,
      name: "Test T-Shirt",
      unit_price: 12.99,
      currency: "GBP",
    });
  });

  it("does not include description or image_urls in listing", async () => {
    const res = await request(app).get("/products").expect(200);
    expect(res.body.results[0]).not.toHaveProperty("description");
    expect(res.body.results[0]).not.toHaveProperty("image_urls");
  });
});
```

- [ ] **Step 2: Run test to confirm it fails**

```bash
bun run --filter api test -- --reporter=verbose
```

Expected: FAIL — `Cannot find module '../src/routes/products.js'`

- [ ] **Step 3: Create `packages/api/src/routes/products.ts`**

```typescript
import { Router } from "express";
import { prisma } from "../db/prisma.js";

const router = Router();

router.get("/", async (_req, res, next) => {
  try {
    const products = await prisma.product.findMany({
      select: {
        id: true,
        name: true,
        primary_image: true,
        unit_price: true,
        currency: true,
      },
    });

    res.json({
      results: products.map((p) => ({
        ...p,
        unit_price: Number(p.unit_price),
      })),
    });
  } catch (err) {
    next(err);
  }
});

export default router;
```

- [ ] **Step 4: Run test to confirm it passes**

```bash
bun run --filter api test -- --reporter=verbose
```

Expected: PASS — `GET /products > returns a results array with all products` ✓

- [ ] **Step 5: Commit**

```bash
git add packages/api/src/routes/products.ts api/tests/products.test.ts
git commit -m "feat: add GET /products endpoint"
```

---

### Task 8: GET /products/:id Endpoint

**Files:**

- Modify: `packages/api/src/routes/products.ts`
- Modify: `packages/api/tests/products.test.ts`

**Interfaces:**

- Produces: `GET /products/:id` → full `Product` object including `description` and `image_urls`

- [ ] **Step 1: Write the failing test**

Add to `packages/api/tests/products.test.ts`:

```typescript
describe("GET /products/:id", () => {
  it("returns full product details", async () => {
    const res = await request(app).get(`/products/${productId}`).expect(200);
    expect(res.body).toMatchObject({
      id: productId,
      name: "Test T-Shirt",
      description: "A test product",
      primary_image: "https://example.com/img.jpg",
      image_urls: ["https://example.com/img.jpg"],
      unit_price: 12.99,
      currency: "GBP",
    });
  });

  it("returns 404 for a non-existent product", async () => {
    const res = await request(app).get("/products/999999").expect(404);
    expect(res.body).toMatchObject({ error: expect.any(String) });
  });
});
```

- [ ] **Step 2: Run test to confirm it fails**

```bash
bun run --filter api test -- --reporter=verbose
```

Expected: FAIL — `expected 404 to equal 200`

- [ ] **Step 3: Add route to `packages/api/src/routes/products.ts`**

```typescript
router.get("/:id", async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      res.status(404).json({ error: "Product not found", code: "NOT_FOUND" });
      return;
    }

    const product = await prisma.product.findUnique({ where: { id } });

    if (!product) {
      res.status(404).json({ error: "Product not found", code: "NOT_FOUND" });
      return;
    }

    res.json({ ...product, unit_price: Number(product.unit_price) });
  } catch (err) {
    next(err);
  }
});
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
bun run --filter api test -- --reporter=verbose
```

Expected: PASS — all product tests ✓

- [ ] **Step 5: Commit**

```bash
git add packages/api/src/routes/products.ts api/tests/products.test.ts
git commit -m "feat: add GET /products/:id endpoint"
```
