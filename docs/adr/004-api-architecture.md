# ADR 004: API Architecture — Express with Routes/Services Layering

**Status:** Accepted
**Date:** 2026-07-03

## Context

`packages/api` is an Express 5 application (`src/app.ts`) covering products, cart, checkout, and orders, backed by Prisma/PostgreSQL (see [ADR 002](002-database-and-orm.md)) and Stripe for payments.

Originally, route handlers in `src/routes/*.ts` mixed HTTP concerns (parsing `req.body`/`req.params`, status codes, session access) with business logic (Prisma queries, Stripe calls, cart total math, response formatting). `orders.ts` duplicated order-response-shaping code between its POST and GET handlers, and `checkout.ts`/`orders.ts` each constructed their own Stripe client. This made routes hard to read and logic hard to reuse or unit test independently of HTTP (`docs/superpowers/specs/2026-07-02-api-routes-services-design.md`).

## Decision

### Request pipeline

`src/app.ts` wires global middleware in order: CORS (restricted to `http://localhost:3000`, credentials enabled), `express.json()`, then session middleware, followed by one router per resource (`/products`, `/cart`, `/checkout`, `/order`), and a final centralized `errorHandler`.

### Sessions

`src/shared/middleware/session.ts` uses `express-session` with a `connect-pg-simple` store backed by a dedicated `pg.Pool`, independent of the Prisma client. Cart identity (`req.session.cartId`) is tracked via session rather than request auth.

### Routes → Services layering

Business logic lives in `src/features/<name>/<name>.service.ts`, one per resource (`products`, `cart`, `checkout`, `orders`), colocated with its route file (`<name>.routes.ts`) and, where one exists, its test (`<name>.test.ts` — checkout has no dedicated test file, a pre-existing gap) in `src/features/<name>/`. Cross-cutting code — `errors.ts`, the Prisma client, session/error middleware, the shared Stripe client, and session types — lives in `src/shared/`. This feature-based layout replaced the earlier flat `src/routes/` + `src/services/` split on 2026-07-06; see `docs/superpowers/specs/2026-07-06-api-feature-based-restructure-design.md` for the restructuring rationale. The routes-thin/services-hold-logic decision below is unchanged. Routes stay thin:

- Zod schema and `parseInt` parsing, with their own 400 responses, stay in routes.
- The cart-ownership session check (`cartId !== req.session.cartId`) stays in routes — it's a comparison against `req.session`, not a DB concern.
- Setting/clearing `req.session.cartId` stays in routes.
- Each handler calls exactly one service function and shapes the HTTP response.

Services are plain exported functions (no class-based service objects), consistent with the rest of the codebase.

### Error handling

`src/shared/errors.ts` defines a typed error hierarchy: `AppError` (base, carries `statusCode` and `code`), with `NotFoundError` (404, `NOT_FOUND`), `ForbiddenError` (403, `FORBIDDEN`), and `PaymentFailedError` (`PAYMENT_FAILED`, defaults to 400, overridable). Services throw these directly.

`src/shared/middleware/error.ts` catches `AppError` instances and responds with `{ error: message, code }` at the error's `statusCode`; anything else is logged via `console.error` and returned as a generic 500 `{ error: "Internal server error", code: "INTERNAL_ERROR" }`. Routes forward errors to it via `next(err)` from their existing `try/catch` blocks.

## Consequences

- Route files are reduced to input parsing, one service call, and response shaping — business logic (Prisma queries, Stripe calls, calculations, formatting) lives solely in services.
- New error cases should be modeled as `AppError` subclasses rather than ad-hoc `res.status(...).json(...)` calls in services, so they flow through the centralized handler.
- Since routes still perform input validation and some session logic directly, "thin routes" here means no business logic, not zero logic — see `docs/superpowers/specs/2026-07-02-api-routes-services-design.md` for the exact split.
- The existing supertest suite (now colocated as `packages/api/src/features/*/*.test.ts` and `packages/api/src/shared/middleware/error.test.ts`) asserts on exact response bodies and status codes; any change to this layering must keep those responses byte-identical or update the tests deliberately.
