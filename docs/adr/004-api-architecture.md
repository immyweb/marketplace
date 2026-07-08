# ADR 004: API Architecture — Express with Routes/Services Layering

**Status:** Accepted
**Date:** 2026-07-03

## Context

`packages/api` is an Express 5 application (`src/app.ts`) covering products, cart, checkout, and orders, backed by Prisma/PostgreSQL (see [ADR 002](002-database-and-orm.md)) and Stripe for payments.

Originally, route handlers in `src/routes/*.ts` mixed HTTP concerns (parsing `req.body`/`req.params`, status codes, session access) with business logic (Prisma queries, Stripe calls, cart total math, response formatting). `orders.ts` duplicated order-response-shaping code between its POST and GET handlers, and `checkout.ts`/`orders.ts` each constructed their own Stripe client. This made routes hard to read and logic hard to reuse or unit test independently of HTTP (`docs/superpowers/specs/2026-07-02-api-routes-services-design.md`).

## Decision

### Request pipeline

`src/app.ts` wires global middleware in order: `pino-http` request logging (see Logging below), CORS (restricted to `http://localhost:3000`, credentials enabled), `express.json()`, then session middleware, followed by one router per resource (`/products`, `/cart`, `/checkout`, `/order`), and a final centralized `errorHandler`.

### Logging

`src/shared/logger.ts` (added 2026-07-08) exports a single shared `pino` instance. Route/service code that needs to log — `src/shared/middleware/error.ts`, `src/features/orders/orders.service.ts` — imports it directly; there is no per-request logger threaded through function signatures. Log level defaults to `debug` outside production and `info` in production, overridable via `LOG_LEVEL`; output is pretty-printed via `pino-pretty` outside production and raw JSON in production.

`app.ts` also mounts `pino-http`, built from the same instance, as the very first middleware — ahead of CORS — so every request gets an automatic completion log line (method, path, status, response time) with no changes to route files. The mount redacts `req.headers.cookie`, `req.headers.authorization`, and `res.headers['set-cookie']`: pino-http's default serializers otherwise log full request/response headers, and this app's cookie-based sessions (`express-session`, Better Auth) would leak live session tokens into the log store without it. See `docs/superpowers/specs/2026-07-08-api-pino-logging-design.md` for the design rationale.

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

`src/shared/middleware/error.ts` catches `AppError` instances, logs them at `warn` via the shared logger, and responds with `{ error: message, code }` at the error's `statusCode`; anything else is logged at `error` (the caught error passed under an `err` key for structured stack-trace serialization) and returned as a generic 500 `{ error: "Internal server error", code: "INTERNAL_ERROR" }`. Routes forward errors to it via `next(err)` from their existing `try/catch` blocks.

### Module resolution

Imports that cross out of the current directory (anything that would otherwise start with `../`) use the `@/*` path alias (`@/shared/errors`, `@/features/products`), mapped in `tsconfig.json` to `./src/*`. Same-directory/sibling imports (e.g. `./checkout.service`) stay relative. This mirrors the `@/*` convention already used in `packages/web`.

The alias needed separate wiring per runtime, since none of them share a single resolution step (added 2026-07-07):

- **Bun** (`bun --watch index.ts`, the dev script) resolves `tsconfig.json` `paths` natively — no extra tooling.
- **`tsc`** (the build script) only type-checks aliases; it never rewrites module specifiers in emitted JS (a deliberate, permanent TypeScript policy, not a bug). `tsc-alias` runs after `tsc` (`tsc && tsc-alias`) to rewrite `dist/**/*.js` imports back to relative paths so the compiled output runs under plain Node module resolution.
- **Vitest** (the test script) uses Vite's resolver, which ignores `tsconfig.json` by default. `vitest.config.ts` sets `resolve: { tsconfigPaths: true }` (Vite's native option — preferred over the `vite-tsconfig-paths` plugin package, which now just wraps the same feature).

## Consequences

- Route files are reduced to input parsing, one service call, and response shaping — business logic (Prisma queries, Stripe calls, calculations, formatting) lives solely in services.
- New error cases should be modeled as `AppError` subclasses rather than ad-hoc `res.status(...).json(...)` calls in services, so they flow through the centralized handler.
- Since routes still perform input validation and some session logic directly, "thin routes" here means no business logic, not zero logic — see `docs/superpowers/specs/2026-07-02-api-routes-services-design.md` for the exact split.
- The existing supertest suite (now colocated as `packages/api/src/features/*/*.test.ts` and `packages/api/src/shared/middleware/error.test.ts`) asserts on exact response bodies and status codes; any change to this layering must keep those responses byte-identical or update the tests deliberately.
- Adding a new cross-directory import means writing `@/...` rather than `../..`; adding a new _runtime_ (a script that imports `src/` code outside Bun, `tsc`, or Vitest) means checking whether it resolves `tsconfig.json` `paths` on its own or needs the same treatment.
- All logging goes through the shared `logger` singleton (`@/shared/logger`), never `console.*`; any future change to `pino-http`'s options (e.g. logging additional headers) must be checked against the `redact` list in `app.ts` so session tokens don't end up in logs.
