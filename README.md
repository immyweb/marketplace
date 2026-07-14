# Marketplace

A clothing and accessories storefront: product listing, semantic product search, cart, checkout, order history, and auth.

## Features

- Product listing with category/sort filters plus natural-language semantic search
- Cart and Stripe-powered checkout
- Order history and account auth (Better Auth)
- CMS-backed footer/policy pages (Contentful)

## Stack

- **`packages/core`** — shared TypeScript types and Zod schemas
- **`packages/api`** — Express + Prisma + PostgreSQL (pgvector), Stripe payments, Better Auth, OpenAI embeddings, Resend email
- **`packages/web`** — Next.js 16 (App Router) + Tailwind CSS v4, Contentful for footer/policy content

Bun workspaces monorepo. See [`docs/adr/`](docs/adr/) for the reasoning behind these choices.

## Setup

```bash
bun install
docker compose up -d          # PostgreSQL on :5433
```

Each package needs its own `.env` (see `packages/api/.env`, `packages/web/.env.local`) with a database URL, Stripe keys, auth secret, and Resend key.

## Develop

```bash
bun run dev                   # api (:3001) + web (:3000)
bun run dev:api
bun run dev:web
```

Storybook for `packages/web` UI components:

```bash
bun run --filter web storybook
```

## Test

```bash
bun run test:api
bun run test:web
bun run test:e2e              # Playwright, critical flows only
```

## Docs

- [`docs/adr/`](docs/adr/) — architecture decisions
- [`docs/superpowers/specs/`](docs/superpowers/specs/) and [`docs/superpowers/plans/`](docs/superpowers/plans/) — feature design docs and implementation plans
