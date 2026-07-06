# API Feature index.ts Barrels Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give each of the four `packages/api/src/features/<name>/` folders a consolidated `index.ts` entry point that re-exports its router and service exports, and wire `app.ts` to import routers through it.

**Architecture:** Purely additive — four new one-line-per-export barrel files, plus a single import-line change in `app.ts`. No logic changes anywhere.

**Tech Stack:** TypeScript, Express 5, Vitest + Supertest, Bun workspaces.

## Global Constraints

- No changes to `*.routes.ts`, `*.service.ts`, or `*.test.ts` logic — additive only (per `docs/superpowers/specs/2026-07-06-api-feature-index-barrels-design.md`).
- No changes to `src/shared/`.
- No new tests — the existing 34 tests exercise `app.ts`, which implicitly verifies each barrel's router re-export.
- Run `bun run test:api` (from repo root) after the change and confirm all 34 tests still pass before considering the task done.

---

### Task 1: Add feature index.ts barrels and wire app.ts

**Files:**

- Create: `packages/api/src/features/products/index.ts`, `packages/api/src/features/cart/index.ts`, `packages/api/src/features/checkout/index.ts`, `packages/api/src/features/orders/index.ts`
- Modify: `packages/api/src/app.ts`

**Interfaces:**

- Produces: `./features/products/index.js` exports `productsRouter` (named) plus everything from `products.service.ts` (`listProducts`, `getProductById`, `ProductDTO`). `./features/cart/index.js` exports `cartRouter` plus everything from `cart.service.ts` (`findCartById`, `addProductToCart`, `updateCartItemQuantity`, `removeCartItem`, `CartDTO`). `./features/checkout/index.js` exports `checkoutRouter` plus everything from `checkout.service.ts` (`createPaymentIntent`). `./features/orders/index.js` exports `ordersRouter` plus everything from `orders.service.ts` (`placeOrder`, `getOrderById`, `OrderDTO`).

- [ ] **Step 1: Create the four barrel files**

Create `packages/api/src/features/products/index.ts`:

```ts
export { default as productsRouter } from "./products.routes.js";
export * from "./products.service.js";
```

Create `packages/api/src/features/cart/index.ts`:

```ts
export { default as cartRouter } from "./cart.routes.js";
export * from "./cart.service.js";
```

Create `packages/api/src/features/checkout/index.ts`:

```ts
export { default as checkoutRouter } from "./checkout.routes.js";
export * from "./checkout.service.js";
```

Create `packages/api/src/features/orders/index.ts`:

```ts
export { default as ordersRouter } from "./orders.routes.js";
export * from "./orders.service.js";
```

- [ ] **Step 2: Update `app.ts`'s route imports**

Replace the four route-import lines in `packages/api/src/app.ts`:

```ts
import productsRouter from "./features/products/products.routes.js";
import cartRouter from "./features/cart/cart.routes.js";
import checkoutRouter from "./features/checkout/checkout.routes.js";
import ordersRouter from "./features/orders/orders.routes.js";
```

with:

```ts
import { productsRouter } from "./features/products/index.js";
import { cartRouter } from "./features/cart/index.js";
import { checkoutRouter } from "./features/checkout/index.js";
import { ordersRouter } from "./features/orders/index.js";
```

The rest of `app.ts` (the `app.use(...)` calls referencing `productsRouter`, `cartRouter`, `checkoutRouter`, `ordersRouter`) is unchanged — same variable names as before.

- [ ] **Step 3: Run the full API test suite and confirm it passes**

Run from the repo root: `bun run test:api`
Expected: All 34 tests pass — this confirms each barrel's router re-export resolves correctly and `app.ts` wires up exactly as before.

- [ ] **Step 4: Type-check build**

Run from `packages/api/`: `bun run build`
Expected: `tsc` completes with zero errors, confirming the new barrel files and `app.ts`'s updated imports all type-check.

- [ ] **Step 5: Commit**

```bash
git add packages/api/src/features/products/index.ts packages/api/src/features/cart/index.ts packages/api/src/features/checkout/index.ts packages/api/src/features/orders/index.ts packages/api/src/app.ts
git commit -m "Add per-feature index.ts export barrels, wire app.ts through them"
```
