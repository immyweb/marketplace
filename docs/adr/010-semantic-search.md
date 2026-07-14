# ADR 010: Semantic Search — pgvector + OpenAI Embeddings

**Status:** Accepted
**Date:** 2026-07-14

## Context

The product listing page only supported browsing by category and sort order — there was no way to find a product by describing it ("warm jacket for hiking"). This ADR records the decision to add natural-language search ranked by semantic similarity, and the storage/embedding choices behind it. See the [design spec](../superpowers/specs/2026-07-14-semantic-product-search-design.md) and [implementation plan](../superpowers/plans/2026-07-14-semantic-product-search.md) for the full detail this ADR summarizes.

## Decision

### `pgvector` on the existing Postgres, not a dedicated vector database

Product embeddings are stored in a `vector(1536)` column on `Product`, via the `pgvector` Postgres extension (`pgvector/pgvector:pg16` image, replacing the plain `postgres:16-alpine` one — see [ADR 002](002-database-and-orm.md)). A separate vector database was rejected: the catalog is small (~100 products), and one more service to run and operate has no payoff at this scale. Similarity search is a single raw SQL query (`ORDER BY embedding <=> :query_vector`) run through Prisma's `$queryRaw`, since Prisma has no native vector column type — `Unsupported("vector(1536)")` plus raw SQL is the standard workaround.

### OpenAI `text-embedding-3-small`, chosen for cost and setup simplicity

This project isn't in production, so the embedding provider was picked for being cheap and trivial to wire up rather than for best-in-class retrieval quality: `text-embedding-3-small` is priced at a fraction of a cent for the whole catalog and needs only an API key, no local model or extra infrastructure. Anthropic's own recommended embeddings partner (Voyage AI) was considered and would be a reasonable alternative, but adds a second vendor account for no benefit here.

### Embeddings generated at seed time, not on a live write path

There is no product create/update API endpoint in this codebase — products only exist via `packages/api/prisma/seed.ts`. Embedding generation therefore lives in the seed script itself (one OpenAI call per product, stored via raw `UPDATE ... SET embedding = ...::vector`), not behind a write-triggered hook. If a real product-authoring path is ever added, it will need its own embed-on-write step; this ADR doesn't provide one.

### Search returns a single ranked page — no real pagination

`searchProducts` always returns the top `PAGE_SIZE` (16) most-similar products in one page (`totalPages: 1`), rather than paginating over the whole ranked catalog. This wasn't the original design — the first implementation paginated the full embedded catalog by cosine rank, which surfaced a real bug: the existing `Pagination` component's links can't carry the search query forward (`buildProductsHref` treats `q` as mutually exclusive with `page`, matching the next decision below), so a multi-page search silently discarded the query on page 2+. Rather than teaching the URL builder and `Pagination` to compose `q` with `page`, search was simplified to a single ranked page — `Pagination` already hides itself when `totalPages <= 1`, so no frontend changes were needed to fix it.

### Search replaces the category filter and sort UI, never combines with them

A search query is mutually exclusive with `category`/`sort`/`page` at both the URL-building layer (`buildProductsHref`) and the API layer (`GET /products` branches to `searchProducts` xor `listProducts`, never both). This keeps the query semantics simple — there's no defined meaning yet for "warm jacket" filtered to a category — at the cost of not letting a user narrow a search by category.

### No new error-handling path

A failed embedding call (seed time or query time) is allowed to throw and propagate through whatever already handles unexpected failures: the seed script exits non-zero, and the API route's existing `catch (err) { next(err) }` turns a search-time failure into the same 500 any other unexpected `/products` error already produces. No search-specific retry, fallback, or user-facing error UI was added.

## Consequences

- `OPENAI_API_KEY` joins Stripe, Resend, and Contentful as an external-service credential `packages/api` depends on.
- Re-embedding only happens by re-running the seed script; there's no backfill mechanism for products added any other way, because no other way exists yet.
- Search has no relevance threshold — ranking is over the entire embedded catalog, so even a nonsensical query returns up to 16 "closest" results rather than "no matches." The search-specific empty state exists for correctness but won't fire in normal operation; a real "not relevant enough" cutoff is a larger, separate feature.
- No vector index (IVFFlat/HNSW) was added — a sequential scan is fast enough at ~100 rows. Revisit if the catalog grows substantially.
- Because search is capped to one page, a search can never surface a product ranked below position 16 — acceptable for a small catalog, but a real limitation if the product count grows without revisiting this decision.
