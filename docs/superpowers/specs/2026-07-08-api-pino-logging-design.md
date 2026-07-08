# API Structured Logging with Pino

**Date:** 2026-07-08
**Status:** Draft

## Context

`packages/api` currently has three ad-hoc logging call sites, all using `console`:

- `src/shared/middleware/error.ts` — `console.error(err)` for unhandled (non-`AppError`) errors before responding 500. `AppError` instances (404s, 403s, payment failures) respond silently with no log at all.
- `src/features/orders/orders.service.ts` — a single `console.error` alert when a Stripe `PaymentIntent` succeeds but the card's `last4` can't be read, built as one long interpolated string.
- `packages/api/index.ts` — `console.log` on server startup.

There is no log level control, no structured fields (everything is string interpolation), and no visibility into request traffic at all. This makes debugging production issues harder than necessary — the goal is real error visibility, not raw log volume.

The API runs on Bun (see [ADR 003](../../adr/003-runtime-environment.md)) and follows the routes/services layering from [ADR 004](../../adr/004-api-architecture.md), which this design does not change.

## Decision

Introduce a single shared Pino logger instance plus `pino-http` for automatic per-request logging. No request-ID correlation, no per-service logger plumbing — kept deliberately minimal.

### Dependencies

Add to `packages/api/package.json`: `pino`, `pino-http` (dependencies), `pino-pretty` (devDependency, dev-only formatting).

**Bun compatibility verified**: `pino`'s `transport` option spins up a worker thread via `thread-stream`, which has historically been a risk area on non-Node runtimes. This was spiked directly — `pino` with a `pino-pretty` transport target was run under Bun 1.3.14 and produced correctly formatted, colorized output including a properly serialized error with stack trace. No workaround needed.

### The logger

New file `src/shared/logger.ts`:

```ts
import pino from "pino";

export const logger = pino({
  level:
    process.env.LOG_LEVEL ??
    (process.env.NODE_ENV === "production" ? "info" : "debug"),
  transport:
    process.env.NODE_ENV === "production"
      ? undefined
      : { target: "pino-pretty" },
});
```

- `LOG_LEVEL` env var overrides the default for either environment (e.g. bumping to `debug` in production during an incident, or `warn` locally to cut noise).
- Production emits raw JSON (cheap to parse/ship to a log aggregator later); non-production is pretty-printed and colorized via `pino-pretty`.
- This is the single exported instance. Both route-level request logging (via `pino-http`, below) and direct service/middleware logging import from this file — there is no separate per-request child logger threaded through service function signatures.

### Request logging

`src/app.ts` mounts `pinoHttp({ logger })` as the **first** middleware in the pipeline, ahead of CORS, the Better Auth handler, `express.json()`, and session middleware. This logs one line per completed request/response (method, path, status code, response time) automatically, with no changes required to any route file. No request ID generation or correlation header is added — logs from a single request are not currently threaded together by an ID; this can be revisited if/when it becomes a debugging pain point.

### Error middleware

`src/shared/middleware/error.ts` changes from silent-on-`AppError`/`console.error`-on-unknown to:

- `AppError` branch: `logger.warn({ code: err.code }, err.message)` before responding — expected/handled failures (payment mismatches, not-found, forbidden) become visible at `warn` level instead of vanishing.
- Fallback branch: `logger.error({ err }, "Unhandled error")` instead of `console.error(err)`. Passing the `Error` under the `err` key lets Pino's standard serializer produce a structured stack trace (verified in the same spike).

### Other call sites

- `orders.service.ts`: the Stripe reconciliation alert becomes `logger.error({ paymentIntentId, cartId, pmType }, "Stripe PaymentIntent succeeded but card last4 is unreadable; customer charged, no order created, manual reconciliation required")` — structured fields instead of string interpolation, same log level and same information.
- `index.ts`: `console.log` on startup becomes `logger.info`.

## Testing

- `error.test.ts`: replace the existing `vi.spyOn(console, "error")` assertion (for the 500 fallback) with `vi.spyOn(logger, "error")`. Add a new test asserting `logger.warn` is called with the error's `code` and `message` for the `AppError` path — this branch is currently silent and untested, so this is new coverage, not a like-for-like rename.
- `orders.test.ts`: no existing test currently covers the `console.error` alert branch (pre-existing gap, not introduced by this change) — no new test added for it here, consistent with not expanding scope beyond the logging swap.
- No dedicated test file for `src/shared/logger.ts` — it is a five-line config object with no conditional logic worth unit-testing in isolation beyond what the spike already confirmed empirically.

## Consequences

- All API error visibility now flows through one Pino instance instead of scattered `console` calls; log level is controllable per-environment via `LOG_LEVEL` without a code change.
- Expected failures (`AppError`s) are now logged at `warn`, giving visibility into how often handled failure paths (e.g. payment amount mismatches) actually occur — previously invisible.
- Every request now produces one log line via `pino-http`, with no request-ID correlation between multiple log lines from the same request. If a future need arises to trace a single request's full story across log lines, `pino-http`'s `genReqId` option can be added without restructuring anything else in this design.
- Services and middleware log through a shared singleton rather than a request-scoped logger passed through function signatures — simpler call sites, at the cost of no per-request context (e.g. request ID) appearing in service-level log lines. Acceptable since request IDs are out of scope here.
