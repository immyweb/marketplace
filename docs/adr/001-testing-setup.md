# ADR 001: Testing Setup — Vitest + Playwright

**Status:** Accepted  
**Date:** 2026-06-30 (amended 2026-07-01, 2026-07-08)

## Context

The project is a Bun monorepo with three packages: `core` (shared types/schemas), `api` (Express + Prisma), and `web` (Next.js). Three distinct testing concerns exist:

1. **API correctness** — routes, business logic, database interactions
2. **UI component behaviour** — rendering, props, interaction, accessible markup for individual pages/components
3. **Critical user flows** — full end-to-end journeys across the running stack

## Decision

### API: Vitest with a real test database

`packages/api` uses Vitest (`vitest run`) with `supertest` for HTTP-layer assertions.

- **Real dependencies for the critical path.** Tests hit a real PostgreSQL instance on port 5433 (`marketplace_test`), connected via the same Prisma client used in production, and a real Stripe test-mode API for payment intents — per `CLAUDE.md`, payment is a critical flow, so it's exercised against the real (test-mode) dependency rather than mocked. Outbound transactional email via Resend isn't a critical flow in that sense, so it's intercepted with `msw/node` (`tests/resend-mock.ts`, wired into `tests/setup.ts`) — added 2026-07-08 alongside the order confirmation email feature. Resend, unlike Stripe, has no test-mode affordance for deterministically triggering a send failure from CI, so its network boundary is mocked the same way the web package already mocks its own API calls (see UI section below).
- **Single fork, serialized.** `pool: 'forks'` with `fileParallelism: false` prevents parallel test files from racing on shared DB state (Vitest 4 replaced the old `poolOptions.forks.singleFork` option with this top-level flag).
- **Setup/teardown** is in `tests/setup.ts`: connects before the suite, disconnects after, and starts/stops the MSW server intercepting Resend calls.

### UI: Vitest + React Testing Library, mocked network via MSW

`packages/web` uses Vitest (`vitest run`) with `@testing-library/react` for component-level tests, config in `vitest.config.ts`. Test files are colocated as `*.test.tsx` next to the component or page they test (e.g. `components/nav.test.tsx`, `app/cart/page.test.tsx`), matching the feature colocation convention in ADR 005. `vitest.config.ts`'s `include` picks up `app/**/*.test.tsx` and `components/**/*.test.tsx`. Shared test infrastructure that isn't specific to one component — setup and MSW fixtures — lives in `test-support/`, imported via the `@/` alias (e.g. `@/test-support/setup`) since its relative path depth varies per test file.

- **jsdom environment**, React plugin via `@vitejs/plugin-react`, `@/*` path aliases resolved natively via Vite 8's `resolve.tsconfigPaths` (no separate plugin needed).
- **Network is mocked with MSW** (`msw/node`), configured in `test-support/setup.ts`. Per `CLAUDE.md`, mocking is fine for most things — component tests should stay fast and isolated from the API/DB, with real integration still covered by the API's own Vitest suite and by Playwright e2e for the critical flows (checkout, cart, payment) that require it.
- **RTL cleanup runs after every test** (`cleanup()` in `afterEach`) — without it, `screen` queries see markup left over from the previous test's render, since `screen` queries the whole `document.body` rather than a per-test container.
- **Async Server Components can be tested directly** by calling the exported page function and awaiting it before passing the result to `render()` (e.g. `render(await ProductListingPage())`). Next.js's own docs say Vitest "does not support" async Server Components, but that caveat is about components using request-scoped APIs (`headers()`, `cookies()`, `draftMode()`) which rely on an `AsyncLocalStorage` store that only exists inside a real Next.js request. Pages that only `await` a data fetch or `params` — as `app/page.tsx` and `app/products/[id]/page.tsx` currently do — render fine outside that context. If a page adopts request-scoped APIs, it will need e2e coverage instead.
- **Testing priority:** UI behaviour should be covered by component tests first. Playwright e2e is reserved for critical flows only (checkout, cart, payment) where a real cross-page, cross-service journey needs verifying — not for coverage that a component test can already provide.

### E2E: Playwright against live dev servers

`packages/web` also uses Playwright (`@playwright/test`), config in `playwright.config.ts`, for the critical flows called out above.

- **Two browser targets:** Desktop Chrome and iPhone 13 (mobile viewport).
- **Two `webServer` entries:** Playwright starts (or reuses) both the API on `:3001` and the web on `:3000` before running tests.
- **Not parallel, no retries** (`fullyParallel: false`, `retries: 0`) — the stack is stateful; parallelism would cause inter-test interference.
- **`reuseExistingServer: true`** allows running against already-running dev servers, which speeds up local iteration.

## Consequences

- API tests are slower than mock-based approaches but catch real integration failures (DB schema drift, query bugs, network behaviour).
- A running Postgres instance on port 5433 is required for API tests. See `docker-compose.yml`.
- Component tests trade real-network coverage for speed and isolation; a component test passing does not guarantee the real API contract matches — that gap is covered by the API's own Vitest suite plus the critical-flow e2e tests, not by component tests.
- E2E tests require both servers healthy before assertions begin; the `webServer` config handles this automatically.
- Adding parallelism to either suite requires solving shared-state isolation first (e.g., per-test DB transactions or separate schemas).
- Because e2e is now scoped to critical flows only, new UI work should default to adding/extending a component test; only add an e2e test when the change affects a critical cross-page flow.
