# Marketplace Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a UK e-commerce marketplace with SSR product browsing, anonymous session-based cart, Stripe checkout, and an order confirmation flow.

**Architecture:** Next.js 15 App Router (SSR) frontend talks to an Express REST API. Cart state lives server-side, tied to anonymous session cookies backed by PostgreSQL via `connect-pg-simple`. Stripe handles payments in test mode — client collects card details via Stripe CardElement, backend creates and confirms the PaymentIntent server-side, then creates the order on success.

**Tech Stack:** Next.js 15 (App Router), Express 5, PostgreSQL 16 (Docker), Prisma 6, TypeScript 5, Bun, express-session + connect-pg-simple, Stripe (test mode), React Hook Form + Zod, Vitest + supertest, Playwright

## Global Constraints

- All code TypeScript — no `.js` files
- API on port `3001`, web on port `3000`
- Currency always `GBP` — no multi-currency logic
- UK-only — no international address forms
- No authentication — all users are guests
- No pagination — `/products` returns all products
- Server is source of truth for cart totals and prices (computed from current `unit_price`, never stored on `CartItem`)
- Tests use real PostgreSQL (test database `marketplace_test`) and real Stripe test-mode keys — no mocking
- All API errors return `{ error: string, code?: string }`
- Commit after every task
- Runtime and package manager: Bun — no npm scripts, no tsx

---

## File Map

```
marketplace/
├── packages/
│   ├── api/
│   │   ├── prisma/
│   │   │   ├── schema.prisma
│   │   │   └── seed.ts
│   │   ├── src/
│   │   │   ├── db/
│   │   │   │   └── prisma.ts            # Prisma client singleton
│   │   │   ├── middleware/
│   │   │   │   ├── session.ts           # express-session + connect-pg-simple setup
│   │   │   │   └── error.ts             # global error handler
│   │   │   ├── routes/
│   │   │   │   ├── products.ts          # GET /products, GET /products/:id
│   │   │   │   ├── cart.ts              # GET/POST/PUT/DELETE /cart
│   │   │   │   ├── checkout.ts          # POST /checkout/payment-intent
│   │   │   │   └── orders.ts            # POST /order
│   │   │   ├── types/
│   │   │   │   └── session.d.ts         # Extends express-session SessionData
│   │   │   └── app.ts                   # Express app (no listen — testable via supertest)
│   │   ├── tests/
│   │   │   ├── setup.ts                 # beforeAll DB clean, afterAll disconnect
│   │   │   ├── products.test.ts
│   │   │   ├── cart.test.ts
│   │   │   └── orders.test.ts
│   │   ├── index.ts                     # Calls app.listen(3001)
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── vitest.config.ts
│   ├── web/
│   │   ├── app/
│   │   │   ├── layout.tsx               # Root layout: <html>, <Nav>
│   │   │   ├── page.tsx                 # PLP — server component, fetches /products
│   │   │   ├── products/[id]/
│   │   │   │   └── page.tsx             # PDP — server component, fetches /products/:id
│   │   │   ├── cart/
│   │   │   │   └── page.tsx             # Cart page — server component, fetches /cart
│   │   │   ├── checkout/
│   │   │   │   └── page.tsx             # Checkout page — client component
│   │   │   └── order-confirmation/[id]/
│   │   │       └── page.tsx             # Confirmation — server component
│   │   ├── components/
│   │   │   ├── nav.tsx                  # Header + cart item count badge
│   │   │   ├── product-card.tsx         # Card for PLP grid
│   │   │   ├── product-gallery.tsx      # Image switcher for PDP
│   │   │   ├── add-to-cart-button.tsx   # Client component: POST /cart/products
│   │   │   ├── cart-item-row.tsx        # Row with qty controls + remove
│   │   │   ├── address-form.tsx         # UK address fields (React Hook Form)
│   │   │   └── stripe-payment-form.tsx  # Stripe CardElement wrapper
│   │   ├── lib/
│   │   │   ├── api.ts                   # Typed fetch wrapper for all API calls
│   │   │   └── stripe.ts                # loadStripe singleton
│   │   ├── tests/e2e/
│   │   │   ├── browse.spec.ts
│   │   │   ├── cart.spec.ts
│   │   │   └── checkout.spec.ts
│   │   ├── next.config.ts
│   │   ├── playwright.config.ts
│   │   ├── package.json
│   │   └── tsconfig.json
│   └── core/
│       ├── src/
│       │   ├── types.ts                 # Product, Cart, CartItem, Order, ApiError — TypeScript interfaces
│       │   ├── schemas.ts               # Zod schemas for all API request bodies + address validation
│       │   └── index.ts                 # Re-exports everything from types.ts and schemas.ts
│       ├── package.json
│       └── tsconfig.json
├── docker-compose.yml
└── package.json                     # Bun workspaces root: ["packages/api", "packages/web", "packages/core"]
```

---

## Phases

| Phase | File | Tasks | Key Deliverables |
|-------|------|-------|-----------------|
| 1 — Infrastructure | [phases/01-infrastructure.md](phases/01-infrastructure.md) | 1–6 | Docker/PG, API scaffold, `@marketplace/core` (shared types + schemas), Prisma schema+seed, sessions, Next.js scaffold |
| 2 — Product API | [phases/02-product-api.md](phases/02-product-api.md) | 7–8 | `GET /products`, `GET /products/:id` |
| 3 — Cart API | [phases/03-cart-api.md](phases/03-cart-api.md) | 9–12 | `GET/POST/PUT/DELETE /cart/products` with session-tied carts |
| 4 — Checkout & Order API | [phases/04-checkout-order-api.md](phases/04-checkout-order-api.md) | 13–14 | Stripe PaymentIntent, `POST /order` |
| 5 — Frontend Foundation | [phases/05-frontend-foundation.md](phases/05-frontend-foundation.md) | 15–16 | API client, layout, nav with cart badge |
| 6 — Product Pages | [phases/06-product-pages.md](phases/06-product-pages.md) | 17–18 | PLP grid, PDP with gallery and add-to-cart |
| 7 — Cart Page | [phases/07-cart-page.md](phases/07-cart-page.md) | 19 | Cart with qty controls and remove |
| 8 — Checkout & Confirmation | [phases/08-checkout-confirmation.md](phases/08-checkout-confirmation.md) | 20–21 | Checkout form + Stripe, order confirmation |
| 9 — SEO & Images | [phases/09-seo-images.md](phases/09-seo-images.md) | 22–23 | AVIF/WebP, metadata, JSON-LD, sitemap.xml |
| 10 — E2E Tests | [phases/10-e2e-tests.md](phases/10-e2e-tests.md) | 24–26 | Browse, cart, and full checkout flows |

---

## Summary

| Phase                       | Tasks | Key Deliverables                                                                                                      |
| --------------------------- | ----- | --------------------------------------------------------------------------------------------------------------------- |
| 1 — Infrastructure          | 1–6   | Docker/PG, API scaffold, `@marketplace/core` (shared types + schemas), Prisma schema+seed, sessions, Next.js scaffold |
| 2 — Product API             | 7–8   | `GET /products`, `GET /products/:id`                                                                                  |
| 3 — Cart API                | 9–12  | `GET/POST/PUT/DELETE /cart/products` with session-tied carts                                                          |
| 4 — Checkout & Order API    | 13–14 | Stripe PaymentIntent, `POST /order`                                                                                   |
| 5 — Frontend Foundation     | 15–16 | API client, layout, nav with cart badge                                                                               |
| 6 — Product Pages           | 17–18 | PLP grid, PDP with gallery and add-to-cart                                                                            |
| 7 — Cart Page               | 19    | Cart with qty controls and remove                                                                                     |
| 8 — Checkout & Confirmation | 20–21 | Checkout form + Stripe, order confirmation                                                                            |
| 9 — SEO & Images            | 22–23 | AVIF/WebP, metadata, JSON-LD, sitemap.xml                                                                             |
| 10 — E2E Tests              | 24–26 | Browse, cart, and full checkout flows                                                                                 |
