# Add to Cart Confirmation Modal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** After a successful add-to-cart on the product detail page, show a confirmation modal with the message "Successfully added to cart." and two actions: Continue Shopping (→ catalog) and Checkout (→ checkout).

**Architecture:** A new presentational `AddedToCartModal` component wraps `@radix-ui/react-dialog` for accessible dialog behavior (focus trap, Escape, ARIA). `AddToCartButton` gains one more piece of state (`modalOpen`) and opens the modal only after the real `addToCart` network call succeeds — separate from its existing optimistic button-label state, which is untouched.

**Tech Stack:** Next.js App Router, React 19 (`useTransition`, `useOptimistic`), `@radix-ui/react-dialog` (new dependency), Vitest + React Testing Library + MSW for tests.

## Global Constraints

- Modal opens only after the add-to-cart request actually succeeds (not optimistically) — spec decision, confirmed with user.
- "Continue Shopping" → close modal, navigate to `/`. "Checkout" → close modal, navigate to `/checkout`.
- Escape key / backdrop click behaves the same as "Continue Shopping" (close + navigate to `/`).
- No item details (name/quantity/price) in the modal — generic message only: "Successfully added to cart."
- Use the scoped `@radix-ui/react-dialog` package (`import * as Dialog from "@radix-ui/react-dialog"`), matching the existing `@radix-ui/react-slot` convention — not the unified `radix-ui` package.
- No new E2E test — PDP add-to-cart isn't a critical flow (checkout/cart/payment); existing `cart.spec.ts`/`checkout.spec.ts` e2e flows are unaffected since Playwright navigation doesn't require dismissing on-page overlays first.
- Per this project's `CLAUDE.md`: do not `git add`/`git commit` at the end of any task — leave all changes uncommitted for user review. This overrides this skill's usual per-task commit step; skip the "Commit" step in every task below.

---

### Task 1: Add the `@radix-ui/react-dialog` dependency

**Files:**

- Modify: `packages/web/package.json`

**Interfaces:**

- Produces: `@radix-ui/react-dialog` importable as `import * as Dialog from "@radix-ui/react-dialog"` for Task 2.

- [ ] **Step 1: Install the package**

Run from `packages/web`:

```bash
cd packages/web && bun add @radix-ui/react-dialog
```

Expected: `packages/web/package.json`'s `dependencies` gains a `@radix-ui/react-dialog` entry, and `bun.lock` (repo root) updates.

- [ ] **Step 2: Verify it resolves**

Run: `cd packages/web && bunx tsc --noEmit`
Expected: no new errors (the package isn't imported anywhere yet, so this just confirms the install didn't break anything).

---

### Task 2: Create the `AddedToCartModal` component

**Files:**

- Create: `packages/web/components/added-to-cart-modal.tsx`
- Create: `packages/web/tests/component/added-to-cart-modal.test.tsx`

**Interfaces:**

- Consumes: `@radix-ui/react-dialog` (Task 1), `Button` from `@/components/ui/button` (existing — supports `variant="outline"` and default variant, both already styled).
- Produces: `AddedToCartModal({ open: boolean; onOpenChange: (open: boolean) => void })`, default export none (named export `AddedToCartModal`), for Task 3 to render inside `AddToCartButton`.

- [ ] **Step 1: Write the failing tests**

Create `packages/web/tests/component/added-to-cart-modal.test.tsx`:

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { AddedToCartModal } from "@/components/added-to-cart-modal";

const { push } = vi.hoisted(() => ({ push: vi.fn() }));

vi.mock("next/navigation", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/navigation")>()),
  useRouter: () => ({ push, refresh: vi.fn() }),
}));

describe("AddedToCartModal", () => {
  it("renders nothing when closed", () => {
    render(<AddedToCartModal open={false} onOpenChange={vi.fn()} />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("renders the success message and both actions when open", () => {
    render(<AddedToCartModal open={true} onOpenChange={vi.fn()} />);

    expect(
      screen.getByRole("dialog", { name: "Added to Cart" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Successfully added to cart.")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Continue Shopping" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Checkout" }),
    ).toBeInTheDocument();
  });

  it("closes and navigates to the catalog when Continue Shopping is clicked", () => {
    const onOpenChange = vi.fn();
    render(<AddedToCartModal open={true} onOpenChange={onOpenChange} />);

    fireEvent.click(screen.getByRole("button", { name: "Continue Shopping" }));

    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(push).toHaveBeenCalledWith("/");
  });

  it("closes and navigates to checkout when Checkout is clicked", () => {
    const onOpenChange = vi.fn();
    render(<AddedToCartModal open={true} onOpenChange={onOpenChange} />);

    fireEvent.click(screen.getByRole("button", { name: "Checkout" }));

    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(push).toHaveBeenCalledWith("/checkout");
  });

  it("closes and navigates to the catalog when Escape is pressed", () => {
    const onOpenChange = vi.fn();
    render(<AddedToCartModal open={true} onOpenChange={onOpenChange} />);

    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });

    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(push).toHaveBeenCalledWith("/");
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd packages/web && bunx vitest run tests/component/added-to-cart-modal.test.tsx`
Expected: FAIL — `Cannot find module '@/components/added-to-cart-modal'` (the component doesn't exist yet).

- [ ] **Step 3: Create the component**

Create `packages/web/components/added-to-cart-modal.tsx`:

```tsx
"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AddedToCartModal({ open, onOpenChange }: Props) {
  const router = useRouter();

  function close(navigateTo: string) {
    onOpenChange(false);
    router.push(navigateTo);
  }

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(next) => {
        if (!next) close("/");
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-foreground/40" />
        <Dialog.Content className="fixed top-1/2 left-1/2 w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-sm border border-border bg-card p-6 shadow-xs">
          <Dialog.Title className="font-display text-lg font-bold tracking-wide uppercase">
            Added to Cart
          </Dialog.Title>
          <Dialog.Description className="mt-2 text-sm text-muted-foreground">
            Successfully added to cart.
          </Dialog.Description>
          <div className="mt-6 flex justify-end gap-3">
            <Button variant="outline" onClick={() => close("/")}>
              Continue Shopping
            </Button>
            <Button onClick={() => close("/checkout")}>Checkout</Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd packages/web && bunx vitest run tests/component/added-to-cart-modal.test.tsx`
Expected: PASS (5 tests).

---

### Task 3: Wire the modal into `AddToCartButton`

**Files:**

- Modify: `packages/web/components/add-to-cart-button.tsx`
- Modify: `packages/web/tests/component/msw-handlers.ts`
- Modify: `packages/web/tests/component/product-detail-page.test.tsx`

**Interfaces:**

- Consumes: `AddedToCartModal` from `@/components/added-to-cart-modal` (Task 2).

- [ ] **Step 1: Add a default success handler for `POST /cart/products`**

`packages/web/tests/component/msw-handlers.ts` currently has no handler for `POST /cart/products` at all — any test that clicks "Add to Cart" today would hit `onUnhandledRequest: "error"` in `tests/component/setup.ts`. Add one so Task 3's new tests (and the modal-open path in general) have a default success response.

In `packages/web/tests/component/msw-handlers.ts`, find the `http.get(\`${API_URL}/cart\`, ...)`handler inside the`handlers` array and add a new handler directly after it:

```ts
  http.get(`${API_URL}/cart`, () => {
    return HttpResponse.json(cart);
  }),
  http.post(`${API_URL}/cart/products`, () => {
    return HttpResponse.json(cart);
  }),
```

- [ ] **Step 2: Write the failing tests**

In `packages/web/tests/component/product-detail-page.test.tsx`, make these changes:

Replace the imports and router mock at the top of the file:

```tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { server } from "./setup";
import { http, HttpResponse } from "msw";
import { product } from "./msw-handlers";
import ProductDetailPage from "@/app/products/[id]/page";

const { push } = vi.hoisted(() => ({ push: vi.fn() }));

vi.mock("next/navigation", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/navigation")>()),
  useRouter: () => ({ push, refresh: vi.fn() }),
}));
```

Add a `beforeEach` inside the `describe("ProductDetailPage", ...)` block, before the existing `it(...)` calls:

```tsx
beforeEach(() => {
  push.mockClear();
});
```

Add these four tests inside the same `describe` block, after the existing "throws a Next.js not-found error..." test:

```tsx
it("opens a confirmation modal after successfully adding to cart", async () => {
  render(await renderPage(String(product.id)));

  fireEvent.click(screen.getByRole("button", { name: "Add to Cart" }));

  expect(
    await screen.findByRole("dialog", { name: "Added to Cart" }),
  ).toBeInTheDocument();
  expect(screen.getByText("Successfully added to cart.")).toBeInTheDocument();
});

it("navigates to the catalog when Continue Shopping is clicked", async () => {
  render(await renderPage(String(product.id)));

  fireEvent.click(screen.getByRole("button", { name: "Add to Cart" }));
  await screen.findByRole("dialog");
  fireEvent.click(screen.getByRole("button", { name: "Continue Shopping" }));

  await waitFor(() => expect(push).toHaveBeenCalledWith("/"));
});

it("navigates to checkout when Checkout is clicked", async () => {
  render(await renderPage(String(product.id)));

  fireEvent.click(screen.getByRole("button", { name: "Add to Cart" }));
  await screen.findByRole("dialog");
  fireEvent.click(screen.getByRole("button", { name: "Checkout" }));

  await waitFor(() => expect(push).toHaveBeenCalledWith("/checkout"));
});

it("does not open the modal when adding to cart fails", async () => {
  server.use(
    http.post("http://localhost:3001/cart/products", () =>
      HttpResponse.json({ error: "Something went wrong" }, { status: 500 }),
    ),
  );
  render(await renderPage(String(product.id)));

  fireEvent.click(screen.getByRole("button", { name: "Add to Cart" }));

  expect(await screen.findByRole("alert")).toHaveTextContent(
    "Something went wrong",
  );
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
});
```

- [ ] **Step 3: Run the tests to verify the new ones fail**

Run: `cd packages/web && bunx vitest run tests/component/product-detail-page.test.tsx`
Expected: the 4 new tests FAIL (no modal ever opens yet — `AddToCartButton` doesn't render `AddedToCartModal`); the 4 pre-existing tests still PASS.

- [ ] **Step 4: Wire the modal into `AddToCartButton`**

Replace the full contents of `packages/web/components/add-to-cart-button.tsx`:

```tsx
"use client";

import { useOptimistic, useState, useTransition } from "react";
import { addToCart } from "@/lib/api";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { AddedToCartModal } from "@/components/added-to-cart-modal";

interface Props {
  productId: number;
}

export function AddToCartButton({ productId }: Props) {
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [added, setAdded] = useOptimistic(
    false,
    (_state, next: boolean) => next,
  );
  const router = useRouter();

  function handleClick() {
    setError(null);
    startTransition(async () => {
      setAdded(true);
      try {
        await addToCart(productId, 1);
        setModalOpen(true);
        // Kept in the same transition so the optimistic "Added to Cart"
        // label holds until the refreshed nav badge is ready, instead of
        // flickering back to "Add to Cart" while the refresh is in flight.
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to add to cart");
      }
    });
  }

  return (
    <div className="mt-4">
      <Button onClick={handleClick} disabled={isPending} aria-busy={isPending}>
        {added ? "Added to Cart" : "Add to Cart"}
      </Button>
      {error && (
        <p role="alert" className="mt-2 text-sm text-destructive">
          {error}
        </p>
      )}
      <AddedToCartModal open={modalOpen} onOpenChange={setModalOpen} />
    </div>
  );
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `cd packages/web && bunx vitest run tests/component/product-detail-page.test.tsx`
Expected: PASS (8 tests: the original 4 plus the 4 new ones).

- [ ] **Step 6: Run the full component test suite**

Run: `cd packages/web && bun run test`
Expected: all test files pass (includes `added-to-cart-modal.test.tsx` from Task 2 and every other existing component test — confirms nothing else regressed, e.g. `cart-page.test.tsx`, `checkout-page.test.tsx`).

- [ ] **Step 7: Typecheck**

Run: `cd packages/web && bunx tsc --noEmit`
Expected: no errors.

---

## Manual Verification (after Task 3)

Not a substitute for the automated tests above, but worth eyeballing once both dev servers are running (`bun run dev:api`, `bun run dev:web`):

1. Go to any product detail page, click "Add to Cart".
2. Confirm the modal appears with "Successfully added to cart." and both buttons, styled consistently with the rest of the site (loden/canvas/brass palette, condensed uppercase title).
3. Click "Continue Shopping" → lands on `/` with the modal gone.
4. Repeat, click "Checkout" instead → lands on `/checkout` with the modal gone.
5. Repeat, press Escape instead → same as Continue Shopping.
6. Repeat, click the dimmed backdrop outside the modal instead → same as Continue Shopping (this path isn't covered by an automated test — it shares the same `onOpenChange` handler as Escape, but is worth eyeballing once since it's explicitly called out in the spec).
7. Confirm the cart nav badge still increments correctly after each add (the existing `router.refresh()` behavior is unchanged).
