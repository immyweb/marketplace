# Web Feature Colocation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restructure `packages/web` so feature-specific components and lib code are colocated inside their App Router route segment (using Next.js's private `_components`/`_lib` folder convention), each folder exposing a barrel `index.ts` — mirroring the feature-folder/barrel pattern already used in `packages/api/src/features/*`. Update ADR 005 to document the resulting architecture.

**Architecture:** This is a pure file-relocation refactor — no behavior changes, no new functionality. Components/lib files used by exactly one route move into that route's `_components`/`_lib` private folder. Each such folder gets an `index.ts` barrel re-exporting its public members (matching `packages/api/src/features/cart/index.ts`'s `export { X } from "./x"` style). External consumers (a route's `page.tsx`) import from the barrel (`./_components`); files inside the same folder import each other directly by sibling path (e.g. `./added-to-cart-modal`), never through the barrel — matching how `cart.routes.ts` imports `./cart.service` directly rather than `./index`, which avoids a self-referential circular import. Anything used by 2+ routes (or the root layout) stays in the existing top-level `components/`/`lib/` (import-aliased via `@/`).

**Tech Stack:** Next.js 16 App Router, TypeScript, Vitest + React Testing Library (`packages/web/tests/component`), Playwright (`packages/web/tests/e2e`). Path alias `@/*` → `packages/web/*` (see `packages/web/tsconfig.json`).

## Global Constraints

- No behavior change — every step is a move, a barrel re-export, or an import-path update. If any test's assertions need to change, stop; that means the mapping below is wrong.
- Never auto-commit — per project `CLAUDE.md` Rule 6, leave changes uncommitted after each task for user review. Do not run `git commit`. This overrides the default "Commit" step in the plan template.
- Files that stay shared (do not move): `components/nav.tsx`, `components/ui/button.tsx`, `components/ui/dropdown-menu.tsx`, `lib/api.ts`, `lib/utils.ts`. These are used by 2+ routes (or the root layout) and remain at `@/components/*` / `@/lib/*`.
- Barrel convention: each new `_components`/`_lib` folder gets an `index.ts` that re-exports every component/value defined in that folder (matching `packages/api/src/features/cart/index.ts`), even members not currently imported externally. Same-folder files import each other by direct sibling path, never via the barrel.
- Use `git mv` for every move so history is preserved.
- All commands below are run with `packages/web` as the working directory unless stated otherwise.

---

## File Structure

| Current path                            | New path                                                | Why                                                                                      |
| --------------------------------------- | ------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| `components/product-card.tsx`           | `app/_components/product-card.tsx`                      | Only used by `app/page.tsx` (product listing, the root route)                            |
| `components/product-filters.tsx`        | `app/_components/product-filters.tsx`                   | Only used by `app/page.tsx`                                                              |
| `components/sort-select.tsx`            | `app/_components/sort-select.tsx`                       | Only used by `product-filters.tsx`                                                       |
| `components/pagination.tsx`             | `app/_components/pagination.tsx`                        | Only used by `app/page.tsx`                                                              |
| _(new)_                                 | `app/_components/index.ts`                              | Barrel for the above four                                                                |
| `components/product-gallery.tsx`        | `app/products/[id]/_components/product-gallery.tsx`     | Only used by `app/products/[id]/page.tsx`                                                |
| `components/add-to-cart-button.tsx`     | `app/products/[id]/_components/add-to-cart-button.tsx`  | Only used by `app/products/[id]/page.tsx`                                                |
| `components/added-to-cart-modal.tsx`    | `app/products/[id]/_components/added-to-cart-modal.tsx` | Only used by `add-to-cart-button.tsx`                                                    |
| _(new)_                                 | `app/products/[id]/_components/index.ts`                | Barrel for the above three                                                               |
| `components/cart-item-row.tsx`          | `app/cart/_components/cart-item-row.tsx`                | Only used by `app/cart/page.tsx`                                                         |
| _(new)_                                 | `app/cart/_components/index.ts`                         | Barrel for the above                                                                     |
| `components/address-form.tsx`           | `app/checkout/_components/address-form.tsx`             | Only used by `app/checkout/page.tsx`                                                     |
| `components/stripe-payment-form.tsx`    | `app/checkout/_components/stripe-payment-form.tsx`      | Only used by `app/checkout/page.tsx`                                                     |
| _(new)_                                 | `app/checkout/_components/index.ts`                     | Barrel for the above two                                                                 |
| `lib/stripe.ts`                         | `app/checkout/_lib/stripe.ts`                           | Only used by `app/checkout/page.tsx`                                                     |
| _(new)_                                 | `app/checkout/_lib/index.ts`                            | Barrel for the above                                                                     |
| `docs/adr/005-frontend-architecture.md` | _(same path, edited)_                                   | Document the colocation + barrel convention; fix the now-stale `lib/stripe.ts` reference |

Unchanged (shared, stay put): `components/nav.tsx`, `components/ui/button.tsx`, `components/ui/dropdown-menu.tsx`, `lib/api.ts`, `lib/utils.ts`.

---

### Task 1: Colocate product-listing components (`/` route)

**Files:**

- Move: `components/product-card.tsx` → `app/_components/product-card.tsx`
- Move: `components/product-filters.tsx` → `app/_components/product-filters.tsx`
- Move: `components/sort-select.tsx` → `app/_components/sort-select.tsx`
- Move: `components/pagination.tsx` → `app/_components/pagination.tsx`
- Create: `app/_components/index.ts`
- Modify: `app/_components/product-filters.tsx` (import of `sort-select`)
- Modify: `app/page.tsx` (import the three components from the barrel)
- Modify: `tests/component/pagination.test.tsx` (import path)
- Modify: `tests/component/product-filters.test.tsx` (import path)
- Test: `tests/component/pagination.test.tsx`, `tests/component/product-filters.test.tsx`, `tests/component/product-listing-page.test.tsx` (all pre-existing, unmodified assertions)

**Interfaces:**

- Consumes: nothing from other tasks — independent.
- Produces: nothing other tasks depend on — independent.

- [ ] **Step 1: Move the four files**

```bash
mkdir -p app/_components
git mv components/product-card.tsx app/_components/product-card.tsx
git mv components/product-filters.tsx app/_components/product-filters.tsx
git mv components/sort-select.tsx app/_components/sort-select.tsx
git mv components/pagination.tsx app/_components/pagination.tsx
```

- [ ] **Step 2: Update the `sort-select` import inside `product-filters.tsx`**

In `app/_components/product-filters.tsx`, change:

```ts
import { SortSelect } from "@/components/sort-select";
```

to:

```ts
import { SortSelect } from "./sort-select";
```

- [ ] **Step 3: Create the barrel**

Create `app/_components/index.ts`:

```ts
export { ProductCard } from "./product-card";
export { ProductFilters } from "./product-filters";
export { Pagination } from "./pagination";
export { SortSelect } from "./sort-select";
```

- [ ] **Step 4: Update imports in `app/page.tsx`**

Change:

```ts
import { ProductCard } from "@/components/product-card";
import { ProductFilters } from "@/components/product-filters";
import { Pagination } from "@/components/pagination";
```

to:

```ts
import { ProductCard, ProductFilters, Pagination } from "./_components";
```

- [ ] **Step 5: Update the two affected test files**

In `tests/component/pagination.test.tsx`, change:

```ts
import { Pagination } from "@/components/pagination";
```

to:

```ts
import { Pagination } from "@/app/_components";
```

In `tests/component/product-filters.test.tsx`, change:

```ts
import { ProductFilters } from "@/components/product-filters";
```

to:

```ts
import { ProductFilters } from "@/app/_components";
```

- [ ] **Step 6: Run the affected tests**

Run: `cd packages/web && bunx vitest run tests/component/pagination.test.tsx tests/component/product-filters.test.tsx tests/component/product-listing-page.test.tsx`
Expected: all 3 test files PASS with no changed assertions (same pass count as before the move).

- [ ] **Step 7: Leave uncommitted**

Do not run `git commit` (project `CLAUDE.md` Rule 6 — user reviews and commits).

---

### Task 2: Colocate product-detail components (`/products/[id]` route)

**Files:**

- Move: `components/product-gallery.tsx` → `app/products/[id]/_components/product-gallery.tsx`
- Move: `components/add-to-cart-button.tsx` → `app/products/[id]/_components/add-to-cart-button.tsx`
- Move: `components/added-to-cart-modal.tsx` → `app/products/[id]/_components/added-to-cart-modal.tsx`
- Create: `app/products/[id]/_components/index.ts`
- Modify: `app/products/[id]/_components/add-to-cart-button.tsx` (import of `added-to-cart-modal` — stays a direct sibling import, not through the barrel)
- Modify: `app/products/[id]/page.tsx` (import from the barrel)
- Modify: `tests/component/added-to-cart-modal.test.tsx` (import path)
- Test: `tests/component/added-to-cart-modal.test.tsx`, `tests/component/product-detail-page.test.tsx` (pre-existing, unmodified assertions)

**Interfaces:**

- Consumes: nothing from other tasks — independent.
- Produces: nothing other tasks depend on — independent.

- [ ] **Step 1: Move the three files**

```bash
mkdir -p "app/products/[id]/_components"
git mv components/product-gallery.tsx "app/products/[id]/_components/product-gallery.tsx"
git mv components/add-to-cart-button.tsx "app/products/[id]/_components/add-to-cart-button.tsx"
git mv components/added-to-cart-modal.tsx "app/products/[id]/_components/added-to-cart-modal.tsx"
```

- [ ] **Step 2: Update the `added-to-cart-modal` import inside `add-to-cart-button.tsx`**

In `app/products/[id]/_components/add-to-cart-button.tsx`, change:

```ts
import { AddedToCartModal } from "@/components/added-to-cart-modal";
```

to:

```ts
import { AddedToCartModal } from "./added-to-cart-modal";
```

(This is a same-folder sibling import, so it bypasses the barrel by design — see Global Constraints. Leave `import { Button } from "@/components/ui/button";` unchanged — `ui/button` is shared and stays put.)

- [ ] **Step 3: Create the barrel**

Create `app/products/[id]/_components/index.ts`:

```ts
export { ProductGallery } from "./product-gallery";
export { AddToCartButton } from "./add-to-cart-button";
export { AddedToCartModal } from "./added-to-cart-modal";
```

- [ ] **Step 4: Update imports in `app/products/[id]/page.tsx`**

Change:

```ts
import { ProductGallery } from "@/components/product-gallery";
import { AddToCartButton } from "@/components/add-to-cart-button";
```

to:

```ts
import { ProductGallery, AddToCartButton } from "./_components";
```

- [ ] **Step 5: Update the affected test file**

In `tests/component/added-to-cart-modal.test.tsx`, change:

```ts
import { AddedToCartModal } from "@/components/added-to-cart-modal";
```

to:

```ts
import { AddedToCartModal } from "@/app/products/[id]/_components";
```

- [ ] **Step 6: Run the affected tests**

Run: `cd packages/web && bunx vitest run tests/component/added-to-cart-modal.test.tsx tests/component/product-detail-page.test.tsx`
Expected: both test files PASS with no changed assertions.

- [ ] **Step 7: Leave uncommitted**

Do not run `git commit` (project `CLAUDE.md` Rule 6).

---

### Task 3: Colocate cart component (`/cart` route)

**Files:**

- Move: `components/cart-item-row.tsx` → `app/cart/_components/cart-item-row.tsx`
- Create: `app/cart/_components/index.ts`
- Modify: `app/cart/page.tsx` (import from the barrel)
- Test: `tests/component/cart-page.test.tsx` (pre-existing, unmodified assertions)

**Interfaces:**

- Consumes: nothing from other tasks — independent.
- Produces: nothing other tasks depend on — independent.

- [ ] **Step 1: Move the file**

```bash
mkdir -p app/cart/_components
git mv components/cart-item-row.tsx app/cart/_components/cart-item-row.tsx
```

- [ ] **Step 2: Create the barrel**

Create `app/cart/_components/index.ts`:

```ts
export { CartItemRow } from "./cart-item-row";
```

- [ ] **Step 3: Update the import in `app/cart/page.tsx`**

Change:

```ts
import { CartItemRow } from "@/components/cart-item-row";
```

to:

```ts
import { CartItemRow } from "./_components";
```

- [ ] **Step 4: Run the affected test**

Run: `cd packages/web && bunx vitest run tests/component/cart-page.test.tsx`
Expected: PASS with no changed assertions.

- [ ] **Step 5: Leave uncommitted**

Do not run `git commit` (project `CLAUDE.md` Rule 6).

---

### Task 4: Colocate checkout components and lib (`/checkout` route)

**Files:**

- Move: `components/address-form.tsx` → `app/checkout/_components/address-form.tsx`
- Move: `components/stripe-payment-form.tsx` → `app/checkout/_components/stripe-payment-form.tsx`
- Move: `lib/stripe.ts` → `app/checkout/_lib/stripe.ts`
- Create: `app/checkout/_components/index.ts`
- Create: `app/checkout/_lib/index.ts`
- Modify: `app/checkout/page.tsx` (imports of `address-form`, `stripe-payment-form`, `stripe` — all via barrels)
- Test: `tests/component/checkout-page.test.tsx` (pre-existing, unmodified assertions)

**Interfaces:**

- Consumes: nothing from other tasks — independent.
- Produces: nothing other tasks depend on — independent.

- [ ] **Step 1: Move the three files**

```bash
mkdir -p app/checkout/_components app/checkout/_lib
git mv components/address-form.tsx app/checkout/_components/address-form.tsx
git mv components/stripe-payment-form.tsx app/checkout/_components/stripe-payment-form.tsx
git mv lib/stripe.ts app/checkout/_lib/stripe.ts
```

- [ ] **Step 2: Create the barrels**

Create `app/checkout/_components/index.ts`:

```ts
export { AddressForm } from "./address-form";
export { StripePaymentForm } from "./stripe-payment-form";
```

Create `app/checkout/_lib/index.ts`:

```ts
export { stripePromise } from "./stripe";
```

- [ ] **Step 3: Update imports in `app/checkout/page.tsx`**

Change:

```ts
import { stripePromise } from "@/lib/stripe";
import { fetchCart, createPaymentIntent, placeOrder } from "@/lib/api";
import { AddressForm } from "@/components/address-form";
import { StripePaymentForm } from "@/components/stripe-payment-form";
import { Button } from "@/components/ui/button";
```

to:

```ts
import { stripePromise } from "./_lib";
import { fetchCart, createPaymentIntent, placeOrder } from "@/lib/api";
import { AddressForm, StripePaymentForm } from "./_components";
import { Button } from "@/components/ui/button";
```

(`@/lib/api` and `@/components/ui/button` stay unchanged — both are shared.)

- [ ] **Step 4: Run the affected test**

Run: `cd packages/web && bunx vitest run tests/component/checkout-page.test.tsx`
Expected: PASS with no changed assertions.

- [ ] **Step 5: Leave uncommitted**

Do not run `git commit` (project `CLAUDE.md` Rule 6).

---

### Task 5: Final verification

**Files:** none (verification only — no code changes in this task).

**Interfaces:**

- Consumes: the completed state of Tasks 1–4.
- Produces: nothing — this is the plan's code-correctness gate (Task 6 handles docs).

- [ ] **Step 1: Confirm shared folders only contain shared files**

Run: `ls packages/web/components packages/web/components/ui packages/web/lib`
Expected: `components/` contains only `nav.tsx` and `ui/`; `components/ui/` contains `button.tsx` and `dropdown-menu.tsx`; `lib/` contains only `api.ts` and `utils.ts`.

- [ ] **Step 2: Confirm every new folder has a barrel**

Run: `ls packages/web/app/_components packages/web/app/products/\[id\]/_components packages/web/app/cart/_components packages/web/app/checkout/_components packages/web/app/checkout/_lib`
Expected: each listed folder contains `index.ts` alongside its moved file(s).

- [ ] **Step 3: Run the full component test suite**

Run: `cd packages/web && bun run test`
Expected: all tests PASS, same total test count as before the refactor.

- [ ] **Step 4: Typecheck**

Run: `cd packages/web && bunx tsc --noEmit`
Expected: no errors (confirms every updated import path, including barrel imports, resolves).

- [ ] **Step 5: Run the e2e suite**

Run: `cd packages/web && bun run test:e2e`
Expected: all specs in `tests/e2e/` (`browse`, `cart`, `checkout`) PASS — these exercise the exact routes whose internals moved.

- [ ] **Step 6: Review the diff so far**

Run: `git status --short` and `git diff --stat`
Expected: the 11 renames (via `git mv`, shown as `R`), the 5 new barrel `index.ts` files, and import-line edits in `app/page.tsx`, `app/products/[id]/page.tsx`, `app/cart/page.tsx`, `app/checkout/page.tsx`, `app/_components/product-filters.tsx`, `app/products/[id]/_components/add-to-cart-button.tsx`, and the two test files. Nothing else should be touched yet (Task 6 adds the ADR edit).

- [ ] **Step 7: Leave uncommitted**

Do not run `git commit` (project `CLAUDE.md` Rule 6).

---

### Task 6: Update ADR 005 to document the colocation convention

**Files:**

- Modify: `docs/adr/005-frontend-architecture.md`

**Interfaces:**

- Consumes: the completed, verified state of Tasks 1–5.
- Produces: nothing — documentation only.

- [ ] **Step 1: Insert a new Decision subsection**

In `docs/adr/005-frontend-architecture.md`, immediately after the `## Decision` line and before `### Server Components fetch data directly`, insert:

```markdown
### Feature code colocation under `app/`

Components and lib code used by exactly one route live in that route's private `_components`/`_lib` folders (e.g. `app/checkout/_components/stripe-payment-form.tsx`, `app/checkout/_lib/stripe.ts`) rather than the top-level `components/`/`lib/`. The leading underscore opts these folders out of routing (Next.js's private-folder convention). Each such folder exposes a single barrel `index.ts` re-exporting its public members, mirroring the feature-folder/barrel pattern in `packages/api/src/features/*` (e.g. `features/cart/index.ts`). A route's `page.tsx` imports from the barrel (`./_components`); files inside the same folder import each other directly by sibling path (e.g. `add-to-cart-button.tsx` imports `./added-to-cart-modal`, not through the barrel) to avoid a self-referential circular import.

Code shared by two or more routes — `components/nav.tsx`, `components/ui/*`, `lib/api.ts`, `lib/utils.ts` — stays at the top level, imported via the `@/` alias.
```

- [ ] **Step 2: Fix the now-stale `lib/stripe.ts` reference**

In the "Payments: Stripe Elements, card details never touch app state" section, change:

```markdown
`CheckoutPage` wraps the form in Stripe's `<Elements>` provider (`lib/stripe.ts`'s `loadStripe` promise).
```

to:

```markdown
`CheckoutPage` wraps the form in Stripe's `<Elements>` provider (`app/checkout/_lib/stripe.ts`'s `loadStripe` promise).
```

- [ ] **Step 3: Add a Consequences bullet about the reuse tradeoff**

At the end of the `## Consequences` list, add:

```markdown
- A component colocated under one route's `_components` folder that later needs to be used by a second route must be promoted back to the shared top-level `components/` (or `lib/`) — colocation trades cross-route reuse for keeping route-specific code out of the shared namespace.
```

- [ ] **Step 4: Proofread**

Run: `cat docs/adr/005-frontend-architecture.md`
Expected: the new subsection reads correctly under `## Decision`, the `lib/stripe.ts` reference is gone (confirm with `grep -n "lib/stripe" docs/adr/005-frontend-architecture.md` returning no matches), and the new Consequences bullet is present.

- [ ] **Step 5: Leave uncommitted for user review**

Do not run `git commit`. Report the full diff summary (`git status --short`, `git diff --stat`) back to the user per project `CLAUDE.md` Rule 6 — they review and commit explicitly.

---

## Self-Review

**Spec coverage:** All 11 moved files (4 product-listing, 3 product-detail, 1 cart, 3 checkout) are covered across Tasks 1–4, each now paired with a barrel `index.ts`. Shared files (`nav.tsx`, `ui/button.tsx`, `ui/dropdown-menu.tsx`, `lib/api.ts`, `lib/utils.ts`) are explicitly called out as unchanged. Task 5 verifies code correctness (tests, typecheck, e2e, folder contents). Task 6 updates ADR 005 with the new convention and fixes its one stale path reference.

**Placeholder scan:** No TBD/TODO markers; every step shows exact before/after code, exact file contents to create, or an exact command with expected output.

**Type consistency:** All import specifiers (`ProductCard`, `ProductFilters`, `Pagination`, `SortSelect`, `ProductGallery`, `AddToCartButton`, `AddedToCartModal`, `CartItemRow`, `AddressForm`, `StripePaymentForm`, `stripePromise`) are named exports already defined in the source files being moved — barrels re-export them by the same name, so no call site needs a signature change beyond the import path.
