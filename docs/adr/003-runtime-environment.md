# ADR 003: Runtime Environment — Bun Monorepo

**Status:** Accepted  
**Date:** 2026-06-30

## Context

The project has three distinct concerns — shared types, an HTTP API, and a Next.js frontend — that need to share code without a publishing step, and to be started, tested, and built from a single root.

## Decision

### Runtime & package manager: Bun

Bun is both the package manager (`bun.lock`) and the runtime for the API in development (`bun --watch index.ts`). There is no `npm`, `yarn`, or `pnpm` lockfile. All workspace scripts in `package.json` use `bun run`.

No version pin file (`.nvmrc`, `.tool-versions`) is present; the lockfile format version implicitly constrains the Bun version.

### Monorepo: Bun workspaces

Three packages are declared as workspaces in the root `package.json`:

| Package         | Name                | Role                                    |
| --------------- | ------------------- | --------------------------------------- |
| `packages/core` | `@marketplace/core` | Shared Zod schemas and TypeScript types |
| `packages/api`  | `api`               | Express 5 HTTP API                      |
| `packages/web`  | `web`               | Next.js 15 / React 19 frontend          |

Workspace filtering (`bun run --filter <name> <script>`) is used in root scripts to target individual packages. The root `package.json` has no dependencies of its own — it is a workspace orchestrator only.

### TypeScript: run from source, no dev build step

All packages are TypeScript. Bun executes TypeScript directly at runtime — no `ts-node`, `tsx` (for the API), or separate compile step is needed in development.

The API uses `.js` extensions in its internal imports (e.g., `import { app } from './src/app.js'`). Bun resolves `.js` references to `.ts` files automatically, which is why this works without a build step despite the extension mismatch.

The `tsc` build script exists in the API package but is not used in the dev or test workflows — Bun handles execution. TypeScript compilation (`tsc`) is present for type checking or a future production build.

### `@marketplace/core` — source-level sharing

`packages/core` declares `"main": "./src/index.ts"` and `"types": "./src/index.ts"` — it points directly at its TypeScript source. Both `packages/api` and `packages/web` resolve it via `paths` in their respective `tsconfig.json` files, and Next.js is configured with `transpilePackages: ['@marketplace/core']`. There is no build or publish step for core.

### Module formats

| Package | `module` (tsconfig)                    | Reason                                          |
| ------- | -------------------------------------- | ----------------------------------------------- |
| `core`  | `CommonJS`                             | Consumed by both API and Next.js                |
| `api`   | `CommonJS`                             | Standard Node-compatible output                 |
| `web`   | `esnext` + `moduleResolution: bundler` | Next.js handles compilation via its own bundler |

### Next.js runs under Node, not Bun

The web package runs under Next.js's own server (`next dev` / `next start`), which uses Node. Bun is only the dev runtime for the Express API. The Playwright `webServer` config starts both with their own commands.

## Consequences

- Bun must be installed on any machine that runs the project; Node alone is insufficient for the API.
- Adding a new shared utility belongs in `packages/core` and is available immediately — no rebuild or publish needed.
- The `.js` extension convention in API imports must be maintained; switching to extensionless imports would require a tsconfig `moduleResolution` change.
- There is no pinned Bun version. If a Bun update introduces a breaking change, it will not be caught until a developer hits it locally.
