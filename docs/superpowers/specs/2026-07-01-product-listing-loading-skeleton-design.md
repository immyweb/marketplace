# Product Listing Loading Skeleton

## Problem

`packages/web/app/page.tsx` (the "Shop All Products" home listing page) is an
async Server Component that calls `await fetchProducts()` with no loading
state. While the fetch is in flight, the user sees a blank page instead of
any indication content is coming.

## Scope

Add a loading skeleton to the home product listing page only
(`packages/web/app/page.tsx`). The product detail page
(`packages/web/app/products/[id]/page.tsx`) is out of scope.

## Approach

Use the Next.js 16 App Router `loading.tsx` file convention. Placing
`packages/web/app/loading.tsx` alongside `page.tsx` causes Next.js to
automatically wrap `page.tsx` in a `<Suspense>` boundary using this file's
default export as the fallback — no changes to `page.tsx` are required. This
is the standard mechanism for a plain async Server Component with no client
state, and doesn't require the Cache Components / `unstable_instant` opt-in
(this app does not enable `cacheComponents` in `next.config.ts`).

## Components

### `packages/web/components/ui/skeleton.tsx`

A new shadcn `Skeleton` primitive, added the same way the existing
`components/ui/button.tsx` was:

```tsx
import { cn } from "@/lib/utils";

function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      className={cn("animate-pulse rounded-md bg-muted", className)}
      {...props}
    />
  );
}

export { Skeleton };
```

### `packages/web/app/loading.tsx`

Renders the same page shell as `page.tsx` (the `<h1>All Products</h1>` and
the grid), but with 6 placeholder cards instead of real `ProductCard`s. Each
placeholder mirrors `ProductCard`'s shape:

- A square image skeleton (`aspect-square w-full rounded-md`)
- A short title-line skeleton
- A shorter price-line skeleton

The grid uses the same layout classes as the real page
(`grid list-none grid-cols-2 gap-6 p-0 sm:grid-cols-3`) so the skeleton
doesn't jump/reflow when real content swaps in.

The grid container has `role="status" aria-label="Loading products"` so
screen readers announce the loading state once; individual skeleton blocks
are presentational only (no individual ARIA labels needed since the parent
already conveys the state).

## Testing

A component test (Vitest + RTL) in `packages/web/tests/component/` that
renders the `Loading` component directly (no MSW needed — it makes no
network calls) and asserts:

- An element with `role="status"` and accessible name "Loading products" is
  present.
- 6 skeleton placeholder cards are rendered.

This follows ADR 001 (component tests preferred over E2E; this isn't a
critical checkout/cart/payment flow so Playwright isn't warranted).

## Out of scope

- Product detail page loading state.
- Any change to `fetchProducts()` or `page.tsx` itself.
