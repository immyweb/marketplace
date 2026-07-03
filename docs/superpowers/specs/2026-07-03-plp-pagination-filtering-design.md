# PLP Pagination, Sorting & Category Filtering

## Problem

The Product Listing Page (`app/page.tsx`) renders every product on one page (currently 24), with no sorting or filtering. There's also no concept of product category anywhere in the codebase — not in the Prisma schema, `@marketplace/core` types, or seed data. Growing the catalog to 100 products makes an unpaginated, unfiltered grid impractical.

## Goals

- Grow the seeded catalog from 24 to 100 products.
- Add a `category` field to products (new concept — didn't exist before).
- Server-side pagination: 16 products per page.
- Sort by: category (A–Z), price low→high, price high→low.
- Filter by category, one category selected at a time.
- Pagination, sort, and filter state live in the URL (`?page=&sort=&category=`) so results are shareable/bookmarkable and the PLP stays a Server Component per [ADR 005](../../adr/005-frontend-architecture.md).

## Non-Goals

- No free-text search.
- No price-range filter (only category filter was requested).
- No multi-category selection.
- No client-configurable page size (fixed at 16).
- No `Category` relational model — a plain `String` column, consistent with this schema's flat-field style (see [ADR 002](../../adr/002-database-and-orm.md)).

## Design

### `packages/core`

**`types.ts`**

```ts
export const PRODUCT_CATEGORIES = [
  "Tops",
  "Trousers",
  "Knitwear",
  "Outerwear",
  "Footwear",
  "Accessories",
] as const;

export type ProductCategory = (typeof PRODUCT_CATEGORIES)[number];
```

`Product.category: ProductCategory` added to the existing interface. `PRODUCT_CATEGORIES` is the single source of truth — used by API query validation, seed data generation, and the frontend's category pills, so the six values are defined exactly once.

**`schemas.ts`**

```ts
export const ProductListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  sort: z.enum(["category", "price_asc", "price_desc"]).optional(),
  category: z.enum(PRODUCT_CATEGORIES).optional(),
});

export type ProductListQuery = z.infer<typeof ProductListQuerySchema>;
```

Mirrors the existing `AddToCartSchema`/`UpdateCartItemSchema` pattern (schema lives in core, imported by the route).

### `packages/api`

**`prisma/schema.prisma`**: add `category String` to `Product`. New migration.

**`prisma/seed.ts`**: keep the 24 existing products, each assigned a category matching its name (e.g. "Classic White T-Shirt" → `Tops`, "Leather Chelsea Boots" → `Footwear`). Add a small generator that produces ~76 more products to reach 100: for each of the 6 categories, combine category-appropriate adjective/material/item word lists (e.g. Knitwear: ["Merino", "Lambswool", "Cashmere"] × ["Crew Neck", "V-Neck", "Zip-Through"] × ["Jumper", "Cardigan"]) into unique names, with a `placehold.co` image keyed off the name, a description template, and a price drawn from a seeded PRNG (deterministic, no external random-data dependency) within a sensible per-category range (e.g. Accessories £15–£60, Outerwear £60–£180). Distribution across categories doesn't need to be exactly even.

**`src/routes/products.ts`**

```ts
router.get("/", async (req, res, next) => {
  try {
    const parsed = ProductListQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      res
        .status(400)
        .json({ error: parsed.error.errors[0].message, code: "INVALID_INPUT" });
      return;
    }

    const result = await listProducts(parsed.data);
    res.json(result);
  } catch (err) {
    next(err);
  }
});
```

**`src/services/products.service.ts`**

`listProducts({ page, sort, category })`:

- `where`: `category ? { category } : undefined`.
- `orderBy`: `category` → `{ category: "asc" }`; `price_asc` → `{ unit_price: "asc" }`; `price_desc` → `{ unit_price: "desc" }`; no `sort` → `{ id: "asc" }` (current implicit behavior).
- `skip: (page - 1) * 16`, `take: 16`.
- Runs the `findMany` and a `count` (respecting the same `where`) in parallel via `Promise.all`.
- Returns `{ results, total, page, totalPages: Math.ceil(total / 16) }`.
- `ProductDTO` gains `category: string`.

This changes the `GET /products` response shape from `{ results }` to `{ results, total, page, totalPages }` — `tests/products.test.ts` needs updating to match (documented under Testing below).

### `packages/web`

**`lib/api.ts`**

```ts
export function fetchProducts(params?: {
  page?: number;
  sort?: string;
  category?: string;
}) {
  const qs = new URLSearchParams(
    Object.entries(params ?? {}).filter(([, v]) => v != null) as [
      string,
      string,
    ][],
  );
  return apiFetch<{
    results: Omit<Product, "description" | "image_urls">[];
    total: number;
    page: number;
    totalPages: number;
  }>(`/products${qs.size ? `?${qs}` : ""}`);
}
```

**`app/page.tsx`**

Becomes:

```tsx
export default async function ProductListingPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; sort?: string; category?: string }>;
}) {
  const { page, sort, category } = await searchParams;
  const { results, total, totalPages } = await fetchProducts({
    page: page ? Number(page) : undefined,
    sort,
    category,
  });
  // ... render ProductFilters, the grid (unchanged), Pagination
}
```

Empty-state message becomes category-aware ("No products in this category." vs "No products available.") when `category` is set and `results` is empty.

**`components/product-filters.tsx`** (new)

- Category pills: `PRODUCT_CATEGORIES.map(...)` rendered as plain `<Link>`s to `?category=X` (clearing `page`), plus an "All" pill linking to `?` with `category` removed. Active pill styled via comparing to the current `category` searchParam (passed in as a prop from the Server Component page). No client JS needed.
- Sort `<select>`: needs an `onChange` handler, so this part is a small Client Component (`"use client"`) using `useRouter`/`useSearchParams` from `next/navigation` to push `?sort=X` (also resetting `page` to 1) on change.
- Structure: `ProductFilters` (Server Component) renders the category pills directly and a nested `SortSelect` client component for the dropdown — avoids making the whole filter bar a client component.

**`components/pagination.tsx`** (new)

- Receives `page`, `totalPages`, and the other current searchParams (`sort`, `category`) as props (built by the Server Component parent so it can construct hrefs).
- Renders numbered page links (1..totalPages — max 7 at 100 products) plus Previous/Next, each a plain `<Link>` preserving `sort`/`category` in the query string. Current page is a non-link, visually distinct. Previous/Next omitted (not just disabled) at the bounds.
- No client component needed — pure links.

## Testing

**API (`packages/api/tests/products.test.ts`)**, real DB per [ADR 001](../../adr/001-testing-setup.md), seeding a known set of products with distinct categories/prices in `beforeAll`:

- `GET /products` default: returns 16 results (page 1), correct `total`/`totalPages`.
- `GET /products?page=2`: returns the next 16 (or remainder).
- `GET /products?sort=price_asc` / `price_desc`: results ordered by `unit_price`.
- `GET /products?sort=category`: results ordered alphabetically by `category`.
- `GET /products?category=Footwear`: only that category returned, `total` reflects the filtered count.
- `GET /products?sort=bogus` and `?category=bogus`: 400 with `code: "INVALID_INPUT"`.
- Update the existing "returns a results array with all products" test for the new response shape (`total`, `page`, `totalPages` present; with only 1 seeded product, `results` still has length 1).

**Web (`packages/web/tests/component/`)**, Vitest + RTL + MSW per ADR 001:

- `product-filters.test.tsx`: category pill links have the right `href`; active category is visually/aria marked; changing the sort `<select>` navigates to the URL with the new `sort` param and `page` cleared.
- `pagination.test.tsx`: renders the right number of page links for a given `totalPages`; current page isn't a link; Previous is absent on page 1, Next absent on the last page; links preserve `sort`/`category`.
- Extend the existing `packages/web/tests/component/product-listing-page.test.tsx` for the new paginated/filtered response shape from MSW, and update `msw-handlers.ts`'s `/products` handler to return `{ results, total, page, totalPages }`.

No new E2E test — PLP browsing isn't a checkout/cart/payment critical flow per ADR 001.
