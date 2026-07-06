# API Feature index.ts Barrels

## Problem

Each of the four `packages/api/src/features/<name>/` folders (from the recent feature-based restructure, see `docs/superpowers/specs/2026-07-06-api-feature-based-restructure-design.md`) exposes its router and service exports as separate files with no single entry point. `app.ts` imports each router directly from its `<name>.routes.ts` file.

## Goals

- Give each feature one consolidated entry point: `src/features/<name>/index.ts`.
- Each barrel re-exports the feature's router (named export, `<name>Router`) and every named export from its service file (functions and DTO types) via `export *`.
- Update `app.ts` to import each router from the feature's `index.ts` instead of its `*.routes.ts` file directly.

## Non-Goals

- No changes to `*.routes.ts`, `*.service.ts`, or `*.test.ts` logic — this is additive only.
- No changes to `src/shared/`.
- No changes to how tests import `app` or service functions — they continue importing directly from `*.service.ts` / `../../app.js`, not through the new barrels.
- No new tests — the existing 34 tests exercise `app.ts`, which implicitly verifies each barrel's router re-export.

## Design

### File layout (additions only)

```
packages/api/src/features/
  products/index.ts
  cart/index.ts
  checkout/index.ts
  orders/index.ts
```

### Barrel content (per feature)

```ts
// src/features/products/index.ts
export { default as productsRouter } from "./products.routes.js";
export * from "./products.service.js";

// src/features/cart/index.ts
export { default as cartRouter } from "./cart.routes.js";
export * from "./cart.service.js";

// src/features/checkout/index.ts
export { default as checkoutRouter } from "./checkout.routes.js";
export * from "./checkout.service.js";

// src/features/orders/index.ts
export { default as ordersRouter } from "./orders.routes.js";
export * from "./orders.service.js";
```

### app.ts changes

The four route imports change from:

```ts
import productsRouter from "./features/products/products.routes.js";
import cartRouter from "./features/cart/cart.routes.js";
import checkoutRouter from "./features/checkout/checkout.routes.js";
import ordersRouter from "./features/orders/orders.routes.js";
```

to:

```ts
import { productsRouter } from "./features/products/index.js";
import { cartRouter } from "./features/cart/index.js";
import { checkoutRouter } from "./features/checkout/index.js";
import { ordersRouter } from "./features/orders/index.js";
```

Nothing else in `app.ts` changes — the `app.use(...)` calls reference the same variable names as before.

## Testing

No new tests. After the change, run `bun run test:api` and confirm all 34 existing tests still pass — this indirectly proves each barrel's router re-export resolves and works correctly through `app.ts`.

## Open Questions

None — design approved by user as presented.
