# ADR 001: Testing Setup — Vitest + Playwright

**Status:** Accepted  
**Date:** 2026-06-30

## Context

The project is a Bun monorepo with three packages: `core` (shared types/schemas), `api` (Express + Prisma), and `web` (Next.js). Two distinct testing concerns exist:

1. **API correctness** — routes, business logic, database interactions
2. **Browser behaviour** — full user flows across the running stack

## Decision

### API: Vitest with a real test database

`packages/api` uses Vitest (`vitest run`) with `supertest` for HTTP-layer assertions.

- **No mocks.** Tests hit a real PostgreSQL instance on port 5433 (`marketplace_test`), connected via the same Prisma client used in production.
- **Single fork, serialized.** `pool: 'forks'` with `singleFork: true` prevents parallel test files from racing on shared DB state.
- **Setup/teardown** is in `tests/setup.ts`: connects before the suite, disconnects after.

### E2E: Playwright against live dev servers

`packages/web` uses Playwright (`@playwright/test`), config in `playwright.config.ts`.

- **Two browser targets:** Desktop Chrome and iPhone 13 (mobile viewport).
- **Two `webServer` entries:** Playwright starts (or reuses) both the API on `:3001` and the web on `:3000` before running tests.
- **Not parallel, no retries** (`fullyParallel: false`, `retries: 0`) — the stack is stateful; parallelism would cause inter-test interference.
- **`reuseExistingServer: true`** allows running against already-running dev servers, which speeds up local iteration.

## Consequences

- Tests are slower than mock-based approaches but catch real integration failures (DB schema drift, query bugs, network behaviour).
- A running Postgres instance on port 5433 is required for API tests. See `docker-compose.yml`.
- E2E tests require both servers healthy before assertions begin; the `webServer` config handles this automatically.
- Adding parallelism to either suite requires solving shared-state isolation first (e.g., per-test DB transactions or separate schemas).
