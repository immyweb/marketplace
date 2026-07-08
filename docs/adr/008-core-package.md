# ADR 008: Core Package — Per-Domain Types & Schemas

**Status:** Accepted
**Date:** 2026-07-08

## Context

`packages/core` (`@marketplace/core`) holds TypeScript types and Zod validation schemas shared by `packages/api` and `packages/web`, both of which depend on it via `"@marketplace/core": "*"` and run `bun run --filter @marketplace/core build` as a `predev`/`prebuild`/`pretest` step before their own scripts.

The package previously kept all types in one `src/types.ts` and all schemas in one `src/schemas.ts`.

## Decision

`src/` is organized by domain, each folder holding both its types and its Zod schema:

- `product/{types,schema}.ts` — `Product`, `ProductCategory`, `PRODUCT_CATEGORIES` / `ProductListQuerySchema`
- `cart/{types,schema}.ts` — `Cart`, `CartItem`, `CartProduct` / `AddToCartSchema`, `UpdateCartItemSchema`
- `order/{types,schema}.ts` — `Order`, `OrderItem`, `AddressDetails` / `AddressSchema`, `PlaceOrderSchema`
- `auth/schema.ts` — `SignUpSchema`, `SignInSchema` (no `auth/types.ts`: no auth-specific types exist)
- `shared/types.ts` — `ApiError` (not tied to one domain)

`order/types.ts` imports `CartProduct` from `../cart/types` (an `Order` line item reuses the cart product shape) — the one cross-domain import, one-directional.

`src/index.ts` is a single barrel re-exporting all of the above; consumers import everything from `@marketplace/core` and never reach into `product/`, `cart/`, etc. directly.

## Consequences

- Adding or changing a domain's type or schema means editing one folder; nothing in `packages/api` or `packages/web` needs to change as long as the barrel export stays the same, since both only ever import from `@marketplace/core`.
- A new domain (or a type/schema that doesn't belong to `product`, `cart`, `order`, or `auth`) needs a place to live — `shared/` is precedent for the non-domain-specific case.
- `tsconfig.json` (`rootDir: src`, `outDir: dist`, CommonJS) and the package's single `build` script (`tsc`) are unaffected by the folder layout; `dist/index.d.ts` and `dist/index.js` are still the sole compiled entry points per `package.json`'s `main`/`types` fields.
