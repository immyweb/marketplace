# Semantic Product Search

**Date:** 2026-07-14
**Status:** Draft

## Context

The product listing page (`packages/web/app/page.tsx` — served at `/`, despite living under `app/products/_components` for its supporting pieces) currently only supports a category filter and a sort dropdown; there is no text search. This design adds natural-language search: a user types something like "warm jacket for hiking" and gets results ranked by semantic similarity to product name/description/category, rather than exact keyword matching.

Scope, as agreed:

- **Semantic text match only.** No parsing of constraints (price, category) out of the query text — that's a separate, larger feature.
- **Search replaces the existing filters while active.** A query hides the category pills and sort dropdown; clearing it returns to today's browse view. There is no combined "category + search" mode.
- **Products are seed-only.** There is no admin create/update endpoint (`packages/api/prisma/seed.ts` is the only place products are written), so embedding generation is a seed-time step, not something triggered by a product write API.
- This is a learning/practice project, not a production deployment, so the embedding provider choice optimizes for cheap and easy to set up over best-in-class quality or scale.

## Decision

### Infrastructure: pgvector

- `docker-compose.yml`: the `db` service image changes from `postgres:16-alpine` to `pgvector/pgvector:pg16` — same Postgres 16, with the `vector` extension available.
- `packages/api/prisma/schema.prisma`: add the `postgresqlExtensions` preview feature to the `client` generator and `extensions = [vector]` to the `datasource` block. A migration runs `CREATE EXTENSION IF NOT EXISTS vector;` and adds an `embedding` column to `Product` typed as `Unsupported("vector(1536)")?` (nullable — Prisma's client can't write `Unsupported` columns directly, so it's populated via raw SQL after insert; see Seeding below). 1536 matches OpenAI's `text-embedding-3-small` output dimension.
- No vector index (e.g. IVFFlat) is added. The seeded catalog is a few dozen products — a sequential scan over the `embedding` column is fast enough, and an index adds tuning complexity (list count, build-after-populate ordering) with no present benefit. Revisit if the catalog grows substantially.

### Embeddings: OpenAI `text-embedding-3-small`

- New dependency in `packages/api`: `openai`.
- New env var: `OPENAI_API_KEY` in `packages/api/.env`.
- New `packages/api/src/shared/embeddings/embeddings.service.ts` exporting `embedText(text: string): Promise<number[]>`, wrapping a single call to OpenAI's embeddings endpoint with `model: "text-embedding-3-small"`.

### Seed-time embedding generation

- `packages/api/prisma/seed.ts`: after each product's row is created, `embedText` is called with `` `${name}. ${description}. Category: ${category}.` ``, and the resulting vector is written with `prisma.$executeRaw` (`UPDATE products SET embedding = $1::vector WHERE id = $2`) — a raw SQL step is required because Prisma cannot set `Unsupported` columns through its normal create/update API.
- The seed script fails loudly (throws, non-zero exit) if `OPENAI_API_KEY` is missing or any embedding call errors — no silent skip, no partially-embedded catalog. This is a one-shot dev setup command, so surfacing the failure immediately is more useful than a partial success.

### Search API

- `packages/core`: `ProductListQuerySchema` gains an optional `q: z.string().min(1).optional()`. When `q` is present, `category` and `sort` are accepted but ignored server-side (matches "search replaces filters").
- `packages/api/src/features/products/products.service.ts`: new `searchProducts(q: string, page: number)`:
  - embeds `q` via `embedText`
  - runs a `prisma.$queryRaw` selecting `id, name, primary_image, unit_price, currency, category`, ordered by `embedding <=> $1::vector` ascending (pgvector's cosine-distance operator), with `LIMIT`/`OFFSET` matching the existing `PAGE_SIZE`
  - `total`/`totalPages` come from a `SELECT COUNT(*) FROM products WHERE embedding IS NOT NULL` — semantic search ranks the whole embedded catalog rather than filtering a subset, so "total" means "how many products could this query possibly rank," not a count matching some predicate.
- `packages/api/src/features/products/products.routes.ts`: the `GET /products` handler calls `searchProducts` instead of `listProducts` when `parsed.data.q` is present. The response shape (`{ results, total, page, totalPages }`) is unchanged, so the frontend doesn't need to branch on shape — only on which request it made.

### Frontend

- `packages/web/lib/api.ts`: `fetchProducts` gains an optional `q` param appended to the query string.
- `packages/web/app/products/_components/product-href.ts`: `ProductsHrefParams` and `buildProductsHref` gain `q`; when `q` is set, `category` and `sort` are omitted from the built URL (enforces "search replaces filters" at the URL level, not just visually).
- New `packages/web/app/products/_components/product-search.tsx` — a client component with a text input. On change (debounced) or submit, it navigates to `buildProductsHref({ q })`.
- `packages/web/app/page.tsx`: reads `q` from `searchParams`. Always renders `ProductSearch`. Renders `ProductFilters` (which bundles the category pills and `SortSelect`) only when `q` is absent. Passes `q` through to `fetchProducts`.
- Empty state: today's page has two empty-state messages (no products in category / no products at all); a third is added for "No results for '{q}'." when a search returns zero results.

### Error handling

- No new error-handling infrastructure is introduced. `searchProducts` throws on an OpenAI failure the same way `listProducts` throws on a database failure; the existing route `catch (err) { next(err) }` and error middleware handle it identically to any other `/products` failure.
- On the frontend, `apiFetch` already throws `ApiRequestError` on a non-OK response — a failed search surfaces exactly like any other failed `fetchProducts` call does today (there is no root `error.tsx` currently, and this feature doesn't add one).

## Testing

- `packages/api/src/features/products/products.test.ts`: extend with tests for `GET /products?q=...` — mocking `embeddings.service.ts`'s `embedText` (not a critical feature per CLAUDE.md's checkout/cart/payment/auth list, so mocking is appropriate) and asserting the route calls the search path and returns the `{ results, total, page, totalPages }` shape. Cover: happy path with mocked embedding + mocked `$queryRaw` results, and the embedding call failing (asserts the error propagates as a 500).
- `packages/web/app/products/_components/product-search.test.tsx` (new): component test with MSW mocking `GET /products?q=...`, asserting typing a query updates the URL/triggers the search request and clearing it returns to the browse view.
- `packages/web/app/page.test.tsx` (if one exists) or a new test: asserts `ProductFilters`/`SortSelect` are hidden when `q` is present and shown otherwise, and the new "No results for '{q}'." empty state renders on a zero-result search.
- No E2E coverage — search is not a checkout/cart/payment/auth-critical flow (ADR 001).
