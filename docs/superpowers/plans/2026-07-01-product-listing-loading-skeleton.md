# Product Listing Loading Skeleton Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show a card-shaped loading skeleton on the home product listing page (`/`) while `fetchProducts()` is in flight, instead of a blank page.

**Architecture:** A Next.js `app/loading.tsx` file is added alongside `app/page.tsx`. Next.js's App Router automatically wraps `page.tsx` in a `<Suspense>` boundary using `loading.tsx`'s default export as the fallback — no changes to `page.tsx` are needed. `loading.tsx` renders the same page shell and grid layout as the real page, populated with 6 skeleton cards built from a new shadcn `Skeleton` primitive.

**Tech Stack:** Next.js 16 (App Router), React Server Components, Tailwind CSS, shadcn/ui conventions, Vitest + React Testing Library.

## Global Constraints

- TypeScript throughout (per CLAUDE.md).
- No mocking of application code in tests; MSW is only used to mock network calls, and this feature makes none (per ADR 001).
- Match existing shadcn primitive conventions: a `data-slot="<name>"` attribute on the root element, `cn()` from `@/lib/utils` for class merging (see `packages/web/components/ui/button.tsx`).
- Match existing grid/layout classes from `packages/web/app/page.tsx` exactly so the skeleton doesn't reflow when real content swaps in: `mt-6 grid list-none grid-cols-2 gap-6 p-0 sm:grid-cols-3` on the list, `aspect-square w-full rounded-md` on the image block.
- Test file location: `packages/web/tests/component/*.test.tsx` (per `packages/web/vitest.config.ts` `include` pattern).

---

### Task 1: Skeleton primitive, product card skeleton, and loading.tsx

**Files:**

- Create: `packages/web/components/ui/skeleton.tsx`
- Create: `packages/web/components/product-card-skeleton.tsx`
- Create: `packages/web/app/loading.tsx`
- Test: `packages/web/tests/component/product-listing-loading.test.tsx`

**Interfaces:**

- Consumes: `cn` from `@/lib/utils` (existing, see `packages/web/lib/utils.ts`).
- Produces:
  - `Skeleton` — React component, `packages/web/components/ui/skeleton.tsx`, props `React.ComponentProps<'div'>`, renders a `div` with `data-slot="skeleton"`.
  - `ProductCardSkeleton` — React component, `packages/web/components/product-card-skeleton.tsx`, no props, renders one `<li>`-less block (a `div`) containing exactly 3 `Skeleton` elements (image, title, price).
  - `Loading` — default export of `packages/web/app/loading.tsx`, no props, renders the page heading plus a `<ul role="status" aria-label="Loading products">` containing 6 `<li><ProductCardSkeleton /></li>` items.

- [ ] **Step 1: Write the failing test**

Create `packages/web/tests/component/product-listing-loading.test.tsx`:

```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import Loading from "@/app/loading";

describe("Loading (product listing)", () => {
  it("shows an accessible loading status", () => {
    render(<Loading />);

    expect(
      screen.getByRole("status", { name: "Loading products" }),
    ).toBeInTheDocument();
  });

  it("renders 6 skeleton product cards, each with an image, title, and price placeholder", () => {
    const { container } = render(<Loading />);

    const cards = container.querySelectorAll("li");
    expect(cards).toHaveLength(6);

    cards.forEach((card) => {
      expect(card.querySelectorAll('[data-slot="skeleton"]')).toHaveLength(3);
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/web && bun run test -- product-listing-loading`
Expected: FAIL — `Cannot find module '@/app/loading'` (or similar module-not-found error), since none of the three source files exist yet.

- [ ] **Step 3: Create the Skeleton primitive**

Create `packages/web/components/ui/skeleton.tsx`:

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

- [ ] **Step 4: Create the product card skeleton**

Create `packages/web/components/product-card-skeleton.tsx`:

```tsx
import { Skeleton } from "@/components/ui/skeleton";

export function ProductCardSkeleton() {
  return (
    <div>
      <Skeleton className="aspect-square w-full rounded-md" />
      <Skeleton className="mt-3 h-4 w-3/4" />
      <Skeleton className="mt-2 h-4 w-1/4" />
    </div>
  );
}
```

- [ ] **Step 5: Create loading.tsx**

Create `packages/web/app/loading.tsx`:

```tsx
import { ProductCardSkeleton } from "@/components/product-card-skeleton";

export default function Loading() {
  return (
    <>
      <h1 className="text-2xl font-semibold">All Products</h1>
      <ul
        role="status"
        aria-label="Loading products"
        className="mt-6 grid list-none grid-cols-2 gap-6 p-0 sm:grid-cols-3"
      >
        {Array.from({ length: 6 }).map((_, i) => (
          <li key={i}>
            <ProductCardSkeleton />
          </li>
        ))}
      </ul>
    </>
  );
}
```

- [ ] **Step 6: Run test to verify it passes**

Run: `cd packages/web && bun run test -- product-listing-loading`
Expected: PASS (2 tests passing).

- [ ] **Step 7: Run the full web test suite to check for regressions**

Run: `cd packages/web && bun run test`
Expected: All tests PASS (existing `product-listing-page.test.tsx` and `product-detail-page.test.tsx` unaffected, since `page.tsx` was not modified).

- [ ] **Step 8: Commit**

```bash
git add packages/web/components/ui/skeleton.tsx packages/web/components/product-card-skeleton.tsx packages/web/app/loading.tsx packages/web/tests/component/product-listing-loading.test.tsx
git commit -m "feat: add loading skeleton for product listing page"
```
