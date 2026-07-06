# API Feature-Based Folder Restructure

## Problem

`packages/api/src` is organized MVC-style: a flat `routes/*.ts` folder, a flat `services/*.service.ts` folder, plus separate `middleware/`, `db/`, `types/`, and `errors.ts`. Everything about one resource (e.g. cart) is scattered across `routes/cart.ts`, `services/cart.service.ts`, and `tests/cart.test.ts`. As more features are added, this flat layout gets harder to navigate — finding "everything about checkout" means checking three different top-level folders.

This is the first step of a larger effort to add more features to the app; reorganizing to a feature-based structure now makes each future feature a single new folder instead of edits scattered across `routes/`, `services/`, and `tests/`.

## Goals

- Group each resource's route, service, and test into one `src/features/<name>/` folder.
- Give cross-cutting code (middleware, DB client, errors, shared Stripe client, session types) an explicit home: `src/shared/`.
- Colocate tests with the code they cover, including cross-cutting code (`shared/middleware/error.test.ts`).
- Preserve exact existing behavior — this is a pure file-move-and-import-fix refactor, not a logic change. Response bodies, status codes, and error `code` values must stay byte-identical, per ADR 004's existing constraint.
- Update ADR 004 to describe the new file layout, since it currently documents the old flat `routes/`/`services/` paths.

## Non-Goals

- No new features. This reorg is scoped to the existing four resources: products, cart, checkout, orders.
- No logic changes to routes or services — the routes-stay-thin / services-hold-logic split from ADR 004 is preserved as-is.
- No change to route paths, request/response shapes, or status codes.
- No new test coverage added for gaps that predate this reorg (e.g. checkout has no dedicated test file today; it still won't after the move).
- No barrel `index.ts` files per feature — `app.ts` imports each `*.routes.ts` directly.
- No change to `tests/setup.ts`'s role or location — it's global vitest bootstrap (DB connect/disconnect via `vitest.config.ts`'s `setupFiles`), not feature-specific, so it stays in `packages/api/tests/`.

## Design

### File layout

```
packages/api/
  src/
    features/
      cart/
        cart.routes.ts
        cart.service.ts
        cart.test.ts
      checkout/
        checkout.routes.ts
        checkout.service.ts
      orders/
        orders.routes.ts
        orders.service.ts
        orders.test.ts
      products/
        products.routes.ts
        products.service.ts
        products.test.ts
    shared/
      middleware/
        error.ts
        error.test.ts
        session.ts
      db/
        prisma.ts
      types/
        session.d.ts
      errors.ts
      stripe.ts
    app.ts
  tests/
    setup.ts
```

### Mapping from current locations

| Current                            | New                                         |
| ---------------------------------- | ------------------------------------------- |
| `src/routes/cart.ts`               | `src/features/cart/cart.routes.ts`          |
| `src/services/cart.service.ts`     | `src/features/cart/cart.service.ts`         |
| `tests/cart.test.ts`               | `src/features/cart/cart.test.ts`            |
| `src/routes/checkout.ts`           | `src/features/checkout/checkout.routes.ts`  |
| `src/services/checkout.service.ts` | `src/features/checkout/checkout.service.ts` |
| `src/routes/orders.ts`             | `src/features/orders/orders.routes.ts`      |
| `src/services/orders.service.ts`   | `src/features/orders/orders.service.ts`     |
| `tests/orders.test.ts`             | `src/features/orders/orders.test.ts`        |
| `src/routes/products.ts`           | `src/features/products/products.routes.ts`  |
| `src/services/products.service.ts` | `src/features/products/products.service.ts` |
| `tests/products.test.ts`           | `src/features/products/products.test.ts`    |
| `src/middleware/error.ts`          | `src/shared/middleware/error.ts`            |
| `tests/error-handler.test.ts`      | `src/shared/middleware/error.test.ts`       |
| `src/middleware/session.ts`        | `src/shared/middleware/session.ts`          |
| `src/db/prisma.ts`                 | `src/shared/db/prisma.ts`                   |
| `src/types/session.d.ts`           | `src/shared/types/session.d.ts`             |
| `src/errors.ts`                    | `src/shared/errors.ts`                      |
| `src/services/stripe.ts`           | `src/shared/stripe.ts`                      |
| `src/app.ts`                       | `src/app.ts` (unchanged location)           |
| `tests/setup.ts`                   | `tests/setup.ts` (unchanged location)       |

### Import updates

Current cross-file imports (confirmed by inspection — there are no cross-feature imports today; every feature only depends on the shared layer):

- Each `*.service.ts` imports `prisma` from `../db/prisma.js` → becomes `../../shared/db/prisma.js`.
- Each `*.service.ts` imports error classes from `../errors.js` → becomes `../../shared/errors.js`.
- `checkout.service.ts` and `orders.service.ts` import `stripe` from `./stripe.js` → becomes `../../shared/stripe.js`.
- Each `*.routes.ts` imports its service from `../services/<name>.service.js` → becomes `./<name>.service.js` (same folder now).
- `orders.routes.ts` imports `ForbiddenError` from `../errors.js` → becomes `../../shared/errors.js`; same for `checkout.routes.ts`.
- `app.ts` imports routers from `./routes/<name>.js` → becomes `./features/<name>/<name>.routes.js`; imports middleware from `./middleware/*.js` → becomes `./shared/middleware/*.js`.
- `tests/setup.ts` imports `prisma` from `../src/db/prisma.js` → becomes `../src/shared/db/prisma.js`.

No changes to import styles (`.js` extension convention stays as-is), no changes to `tsconfig.json` (`include: ["src", "prisma", "tests", "index.ts"]` already covers the new paths), no changes to `vitest.config.ts` (default test file glob already picks up colocated `*.test.ts` files anywhere under the package).

### ADR update

ADR 004 ("API Architecture — Routes/Services") documents the routes-thin/services-hold-logic split using the old flat `src/routes/`/`src/services/` paths. That decision doesn't change — only the physical file layout does. Amend ADR 004's file-path references to the new `src/features/<name>/` and `src/shared/` locations, and add a line noting the folder structure itself was revised on this date, with a pointer to this spec.

## Testing

No test logic changes — only file moves and import path fixes. After the move, run `bun run test:api` and confirm every existing test in its new location passes unchanged. This is the acceptance check for the whole restructure: since no route/service logic is touched, all responses must remain byte-identical to before the move.

## Open Questions

None — design approved by user as presented.
