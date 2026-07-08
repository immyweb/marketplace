# API Pino Logging Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the three ad-hoc `console.*` calls in `packages/api` with a single shared Pino logger, add automatic per-request logging via `pino-http`, and make previously-silent `AppError` responses visible at `warn` level.

**Architecture:** One new file, `src/shared/logger.ts`, exports a singleton `pino` instance. `src/app.ts` mounts `pino-http` (built from that instance) as the first middleware so every request/response is logged with zero route changes. `src/shared/middleware/error.ts` and `src/features/orders/orders.service.ts` import the same singleton directly for their own structured logging. `index.ts`'s startup message also moves to the logger.

**Tech Stack:** `pino` `^10.3.1`, `pino-http` `^11.0.0`, `pino-pretty` `^13.1.3` (dev-only). Bun 1.3.14, Express 5, Vitest — no changes to these.

## Global Constraints

- No request-ID correlation — out of scope per the approved spec (`docs/superpowers/specs/2026-07-08-api-pino-logging-design.md`).
- No per-request logger threaded through service function signatures — services and middleware import the shared `logger` singleton directly.
- Log level: `process.env.LOG_LEVEL ?? (process.env.NODE_ENV === "production" ? "info" : "debug")`.
- Transport: `pino-pretty` when `NODE_ENV !== "production"`, `undefined` (raw JSON) when `NODE_ENV === "production"`. Verified working under Bun 1.3.14 via a throwaway spike — no workaround needed.
- No new dependencies beyond `pino`, `pino-http`, `pino-pretty`.
- No dedicated test file for `src/shared/logger.ts` — it has no branching logic worth unit-testing in isolation.
- Follow the existing `@/*` import-alias convention for any file under `src/`; `index.ts` (outside `src/`) keeps using relative `./src/...` imports, matching its current style.

---

### Task 1: Add dependencies and create the shared logger

**Files:**

- Modify: `packages/api/package.json`
- Create: `packages/api/src/shared/logger.ts`

**Interfaces:**

- Produces: `logger` (named export from `@/shared/logger`), a `pino.Logger` instance with `.info(msg)`, `.warn(obj, msg)`, `.error(obj, msg)` methods, used by Tasks 2, 3, and 4.

- [ ] **Step 1: Add `pino` and `pino-http` as dependencies, `pino-pretty` as a devDependency**

Edit `packages/api/package.json` — add to `"dependencies"` (keep alphabetical order already used in the file):

```json
    "pino": "^10.3.1",
    "pino-http": "^11.0.0",
```

so the `dependencies` block reads:

```json
  "dependencies": {
    "@marketplace/core": "*",
    "@prisma/adapter-pg": "^7.0.0",
    "@prisma/client": "^7.0.0",
    "better-auth": "^1.6.23",
    "connect-pg-simple": "^10.0.0",
    "pg": "^8.0.0",
    "cors": "^2.8.5",
    "dotenv": "^17.0.0",
    "express": "^5.0.0",
    "express-session": "^1.18.0",
    "pino": "^10.3.1",
    "pino-http": "^11.0.0",
    "stripe": "^22.3.0",
    "zod": "^3.23.0"
  },
```

Add to `"devDependencies"`:

```json
    "pino-pretty": "^13.1.3",
```

so the `devDependencies` block reads:

```json
  "devDependencies": {
    "@types/connect-pg-simple": "^7.0.0",
    "@types/cors": "^2.8.0",
    "@types/express": "^5.0.0",
    "@types/express-serve-static-core": "^5.0.0",
    "@types/express-session": "^1.18.0",
    "@types/node": "^22.0.0",
    "@types/pg": "^8.0.0",
    "@types/supertest": "^7.0.0",
    "pino-pretty": "^13.1.3",
    "prisma": "^7.0.0",
    "supertest": "^7.0.0",
    "tsc-alias": "^1.9.0",
    "typescript": "^6.0.3",
    "vitest": "^4.1.9"
  }
```

- [ ] **Step 2: Install**

Run (from the repo root):

```bash
bun install
```

Expected: exits 0; `packages/api/node_modules/.bin` and the workspace lockfile now include `pino`, `pino-http`, `pino-pretty`.

- [ ] **Step 3: Create the logger**

Create `packages/api/src/shared/logger.ts`:

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

- [ ] **Step 4: Verify it works**

Run (from `packages/api`):

```bash
bun -e "import('./src/shared/logger.ts').then(m => { m.logger.info('smoke test'); m.logger.warn({ code: 'TEST' }, 'warn smoke test'); })"
```

Expected: two colorized, pretty-printed log lines print to the terminal — an `INFO` line reading `smoke test` and a `WARN` line reading `warn smoke test` with a `code: "TEST"` field.

- [ ] **Step 5: Commit**

```bash
git add packages/api/package.json packages/api/src/shared/logger.ts bun.lock
git commit -m "feat(api): add shared pino logger"
```

(If the lockfile has a different name in this repo — e.g. `bun.lockb` — substitute that filename; check `git status` for the actual changed lockfile.)

---

### Task 2: Log errors through the shared logger in the error middleware

**Files:**

- Modify: `packages/api/src/shared/middleware/error.ts`
- Modify: `packages/api/src/shared/middleware/error.test.ts`

**Interfaces:**

- Consumes: `logger` from `@/shared/logger` (Task 1).
- Produces: no new exports — `errorHandler`'s signature and HTTP-facing behavior (status codes, response bodies) are unchanged; only its logging side effects change.

- [ ] **Step 1: Write the failing test assertions**

Replace the full contents of `packages/api/src/shared/middleware/error.test.ts` with:

```ts
import { describe, it, expect, vi } from "vitest";
import { errorHandler } from "./error";
import { NotFoundError } from "@/shared/errors";
import { logger } from "@/shared/logger";

function createRes() {
  const res: any = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res;
}

describe("errorHandler", () => {
  it("maps AppError subclasses to their status code and code, and logs a warning", () => {
    const res = createRes();
    const warnSpy = vi.spyOn(logger, "warn").mockImplementation(() => logger);

    errorHandler(
      new NotFoundError("Widget not found"),
      {} as any,
      res,
      vi.fn(),
    );

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({
      error: "Widget not found",
      code: "NOT_FOUND",
    });
    expect(warnSpy).toHaveBeenCalledWith(
      { code: "NOT_FOUND" },
      "Widget not found",
    );

    warnSpy.mockRestore();
  });

  it("falls back to 500 INTERNAL_ERROR for unknown errors, and logs at error level", () => {
    const res = createRes();
    const err = new Error("boom");
    const errorSpy = vi.spyOn(logger, "error").mockImplementation(() => logger);

    errorHandler(err, {} as any, res, vi.fn());

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      error: "Internal server error",
      code: "INTERNAL_ERROR",
    });
    expect(errorSpy).toHaveBeenCalledWith({ err }, "Unhandled error");

    errorSpy.mockRestore();
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run (from `packages/api`):

```bash
bun run test -- src/shared/middleware/error.test.ts
```

Expected: FAIL — both tests fail on the `warnSpy`/`errorSpy` assertions (`errorHandler` doesn't call `logger.warn` or `logger.error` yet).

- [ ] **Step 3: Update the implementation**

Replace the full contents of `packages/api/src/shared/middleware/error.ts` with:

```ts
import type { Request, Response, NextFunction } from "express";
import { AppError } from "@/shared/errors";
import { logger } from "@/shared/logger";

export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction,
) {
  if (err instanceof AppError) {
    logger.warn({ code: err.code }, err.message);
    res.status(err.statusCode).json({ error: err.message, code: err.code });
    return;
  }

  logger.error({ err }, "Unhandled error");
  res
    .status(500)
    .json({ error: "Internal server error", code: "INTERNAL_ERROR" });
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run (from `packages/api`):

```bash
bun run test -- src/shared/middleware/error.test.ts
```

Expected: PASS — both tests green.

- [ ] **Step 5: Commit**

```bash
git add packages/api/src/shared/middleware/error.ts packages/api/src/shared/middleware/error.test.ts
git commit -m "feat(api): log errors through pino in error middleware"
```

---

### Task 3: Structure the Stripe reconciliation alert through the shared logger

**Files:**

- Modify: `packages/api/src/features/orders/orders.service.ts:1-6` (imports), `:94-104` (the alert call)

**Interfaces:**

- Consumes: `logger` from `@/shared/logger` (Task 1).
- Produces: no new exports — `placeOrder`'s signature, thrown errors, and thrown-error messages are unchanged; only the internal alert log's shape changes (structured fields instead of one interpolated string).

- [ ] **Step 1: Add the logger import**

In `packages/api/src/features/orders/orders.service.ts`, change the top of the file from:

```ts
import type Stripe from "stripe";
import type { Prisma } from "@prisma/client";
import type { AddressInput } from "@marketplace/core";
import { prisma } from "@/shared/db/prisma";
import { NotFoundError, PaymentFailedError } from "@/shared/errors";
import { stripe } from "@/shared/stripe";
```

to:

```ts
import type Stripe from "stripe";
import type { Prisma } from "@prisma/client";
import type { AddressInput } from "@marketplace/core";
import { prisma } from "@/shared/db/prisma";
import { NotFoundError, PaymentFailedError } from "@/shared/errors";
import { stripe } from "@/shared/stripe";
import { logger } from "@/shared/logger";
```

- [ ] **Step 2: Replace the `console.error` alert with a structured `logger.error` call**

Change:

```ts
if (!pm || typeof pm !== "object" || pm.type !== "card" || !pm.card?.last4) {
  console.error(
    "[placeOrder] ALERT: Stripe PaymentIntent succeeded but card last4 is unreadable. " +
      `paymentIntentId=${paymentIntentId} cartId=${cartId} pm_type=${typeof pm === "object" && pm !== null ? (pm as Stripe.PaymentMethod).type : typeof pm}. ` +
      "Customer has been charged but no order was created. Manual reconciliation required.",
  );
  throw new PaymentFailedError("Could not read card details from payment", 500);
}
```

to:

```ts
if (!pm || typeof pm !== "object" || pm.type !== "card" || !pm.card?.last4) {
  logger.error(
    {
      paymentIntentId,
      cartId,
      pmType:
        typeof pm === "object" && pm !== null
          ? (pm as Stripe.PaymentMethod).type
          : typeof pm,
    },
    "Stripe PaymentIntent succeeded but card last4 is unreadable; customer charged, no order created, manual reconciliation required",
  );
  throw new PaymentFailedError("Could not read card details from payment", 500);
}
```

- [ ] **Step 3: Run the existing orders test suite to confirm no regression**

Run (from `packages/api`):

```bash
bun run test -- src/features/orders/orders.test.ts
```

Expected: PASS — this branch isn't currently covered by a test (pre-existing gap, not introduced by this change), so this run confirms the rest of `placeOrder`'s behavior (thrown error messages, status codes) is unchanged.

- [ ] **Step 4: Commit**

```bash
git add packages/api/src/features/orders/orders.service.ts
git commit -m "feat(api): structure the Stripe reconciliation alert log"
```

---

### Task 4: Wire request logging and the startup log into the app entrypoints

**Files:**

- Modify: `packages/api/src/app.ts`
- Modify: `packages/api/index.ts`

**Interfaces:**

- Consumes: `logger` from `@/shared/logger` (Task 1, imported via `@/shared/logger` in `app.ts` and via relative `./src/shared/logger.js` in `index.ts`, matching each file's existing import style).
- Produces: none — `app` is still the same exported Express instance; no route or behavior changes beyond the added request-completion log line.

- [ ] **Step 1: Mount `pino-http` as the first middleware in `app.ts`**

Replace the full contents of `packages/api/src/app.ts` with:

```ts
import "dotenv/config";
import express from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import { toNodeHandler } from "better-auth/node";
import { auth } from "@/shared/auth";
import { logger } from "@/shared/logger";
import { sessionMiddleware } from "@/shared/middleware/session";
import { errorHandler } from "@/shared/middleware/error";
import { productsRouter } from "@/features/products";
import { cartRouter } from "@/features/cart";
import { checkoutRouter } from "@/features/checkout";
import { ordersRouter } from "@/features/orders";

export const app = express();

app.use(pinoHttp({ logger }));

app.use(cors({ origin: "http://localhost:3000", credentials: true }));

// Better Auth's handler must run before express.json() parses the body,
// or its client hangs on "pending".
app.all("/api/auth/*splat", toNodeHandler(auth));

app.use(express.json());
app.use(sessionMiddleware);

app.get("/health", (_req, res) => res.json({ status: "ok" }));

app.use("/products", productsRouter);
app.use("/cart", cartRouter);
app.use("/checkout", checkoutRouter);
app.use("/order", ordersRouter);

app.use(errorHandler);
```

- [ ] **Step 2: Move the startup log to the logger in `index.ts`**

Replace the full contents of `packages/api/index.ts` with:

```ts
import { app } from "./src/app.js";
import { logger } from "./src/shared/logger.js";

const PORT = process.env.PORT ?? 3001;

app.listen(PORT, () => {
  logger.info(`API running on http://localhost:${PORT}`);
});
```

- [ ] **Step 3: Run the full API test suite**

Run (from `packages/api`):

```bash
bun run test
```

Expected: PASS, all existing suites (`products`, `cart`, `orders`, `error`) green. Note: every supertest request in these suites now triggers a real `pino-http` request-completion log line (pretty-printed, since `NODE_ENV` is not `"production"` during `vitest run`) — expect noisier terminal output than before; this is expected and not a failure.

- [ ] **Step 4: Manually verify request logging in the dev server**

Run (from `packages/api`, with the local Postgres dev DB already up as required for the existing `bun run dev` workflow):

```bash
bun run dev &
sleep 2
curl -s http://localhost:3001/health
kill %1
```

Expected: `curl` prints `{"status":"ok"}`; the terminal running `bun run dev` prints a colorized `INFO` startup line (`API running on http://localhost:3001`) followed by an `INFO` "request completed" line for the `/health` request, with `req`/`res`/`responseTime` fields, matching the format confirmed in the pre-implementation spike.

- [ ] **Step 5: Commit**

```bash
git add packages/api/src/app.ts packages/api/index.ts
git commit -m "feat(api): add pino-http request logging and route startup log through pino"
```
