# Sort Dropdown (shadcn) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the PLP's native `<select>` sort control with a shadcn `DropdownMenu`, and standardize this project's existing Radix-based primitives (`button.tsx`, the add-to-cart `Dialog`) onto the same unified `radix-ui` package the new component will use.

**Architecture:** Two sequential tasks. Task 1 runs shadcn's own `migrate radix` CLI command to move `button.tsx` and `added-to-cart-modal.tsx` off the older scoped `@radix-ui/react-slot`/`@radix-ui/react-dialog` packages onto the unified `radix-ui` package — a mechanical, behavior-preserving change verified by the existing test suite passing unmodified. Task 2 scaffolds a new `components/ui/dropdown-menu.tsx` via the shadcn CLI (landing on the same unified package) and rewrites `sort-select.tsx` to use it, with `DropdownMenuRadioGroup`/`DropdownMenuRadioItem` for the four sort options and a `Button`-based trigger showing the current selection.

**Tech Stack:** TypeScript throughout. Next.js 16 App Router, React 19, Tailwind CSS v4. shadcn/ui (`new-york` style, `iconLibrary: lucide`, per `packages/web/components.json`) on the unified `radix-ui` package. Vitest + React Testing Library + `@testing-library/user-event` (new) for component tests.

## Global Constraints

- TypeScript throughout (CLAUDE.md).
- No behavioral change to `Button` or `AddedToCartModal` from the migration — only their internal Radix import source changes, not props, styling, or behavior. The existing test suite is the regression check; no new tests are written for the migration itself.
- `ProductFilters`, `fetchProducts`, `app/page.tsx`, and the `GET /products` API are all out of scope — this plan only touches the sort control's presentation and the two existing Radix-based components' import source.
- Category filtering / URL-driven state behavior of `SortSelect` must be preserved exactly: selecting a sort option clears `page`, sets/clears `sort`, and preserves any active `category` param, via the same `router.push` logic that exists today.
- Never commit (CLAUDE.md Rule 6): every task ends with `git add` + `git status` to confirm what changed, not `git commit`. The user reviews and commits everything at the end.
- Web component tests use MSW only to mock network calls, never application code (ADR 001) — this plan makes no network calls in the components it touches, so no MSW handler changes are needed.

---

### Task 1: Migrate `button.tsx` and `added-to-cart-modal.tsx` to the unified `radix-ui` package

**Files:**

- Modify (via CLI, not hand-edited): `packages/web/components/ui/button.tsx`
- Modify (via CLI, not hand-edited): `packages/web/components/added-to-cart-modal.tsx`
- Modify: `packages/web/package.json` (dependencies)
- Modify: `bun.lock` (via `bun install`)

**Interfaces:**

- Consumes: nothing new.
- Produces: `Button`/`buttonVariants` (`packages/web/components/ui/button.tsx`) and `AddedToCartModal` (`packages/web/components/added-to-cart-modal.tsx`) — same exports, same props, same behavior as before this task; only their internal import source changes. Task 2's new `dropdown-menu.tsx` and rewritten `sort-select.tsx` both use `Button` exactly as it's used today (`<Button variant="outline" size="sm">`, `asChild`), so this task must not change `Button`'s public API.

This task has no dedicated new test — it's a mechanical, behavior-preserving migration verified by the existing suite passing unmodified (per Global Constraints).

- [ ] **Step 1: Confirm current scope**

Run: `grep -rl "@radix-ui" packages/web --include="*.tsx" --include="*.ts" | grep -v node_modules`
Expected output: exactly two files —

```
packages/web/components/added-to-cart-modal.tsx
packages/web/components/ui/button.tsx
```

If this list differs (a third file appears, or one of these two is missing), stop and report — the migration command's `--path` scope below assumes exactly these two files.

- [ ] **Step 2: Run the shadcn migration command**

Run (from `packages/web`):

```bash
cd packages/web
bunx shadcn@latest migrate radix --path components
```

Expected: the CLI reports it updated imports in `components/ui/button.tsx` and `components/added-to-cart-modal.tsx`, and added `radix-ui` to `packages/web/package.json` dependencies. It does not remove the old `@radix-ui/react-slot`/`@radix-ui/react-dialog` entries — that's Step 5, done manually.

- [ ] **Step 3: Verify the migrated files still compile and export the same things**

Read `packages/web/components/ui/button.tsx` and `packages/web/components/added-to-cart-modal.tsx`. Confirm:

- `button.tsx` still imports a `Slot`-equivalent (now from `"radix-ui"` instead of `"@radix-ui/react-slot"`), still uses it for the `asChild` prop exactly as before, and still exports `Button`/`buttonVariants` unchanged.
- `added-to-cart-modal.tsx` still imports a `Dialog`-equivalent (now from `"radix-ui"` instead of `"@radix-ui/react-dialog"`), and all the JSX (`.Root`/`.Portal`/`.Overlay`/`.Content`/`.Title`/`.Description`) still references that import consistently (the CLI may rename the imported binding, e.g. to `DialogPrimitive` — that's fine as long as every usage in the file was updated to match; there should be no leftover reference to the old `Dialog` name if the import was renamed).
- Neither file's exported component's props, CSS classes, or JSX structure changed — only the import line(s) and (if renamed) the identifier used to reference the primitive.

If anything besides the import source changed, or a usage wasn't updated to match a renamed import (causing a broken reference), fix it by hand to restore exact prior behavior before proceeding.

- [ ] **Step 4: Type-check and run the full web suite**

Run: `cd packages/web && bunx tsc --noEmit`
Expected: no errors.

Run: `cd packages/web && bun run test`
Expected: all tests pass, same count as before this task (no test was added or removed in this task). In particular `tests/component/added-to-cart-modal.test.tsx` and any test rendering a `Button` (e.g. `product-detail-page.test.tsx`, `cart-page.test.tsx`) must pass unmodified — this is the regression check for the migration.

- [ ] **Step 5: Remove the now-unused scoped packages**

Run: `grep -rl "@radix-ui/react-slot\|@radix-ui/react-dialog" packages/web --include="*.tsx" --include="*.ts" | grep -v node_modules`
Expected: no output (nothing references them anymore after Step 2's migration).

Edit `packages/web/package.json`, removing these two lines from `dependencies`:

```json
    "@radix-ui/react-dialog": "^1.1.18",
    "@radix-ui/react-slot": "^1.3.0",
```

(`radix-ui`, added by the CLI in Step 2, remains.)

- [ ] **Step 6: Reinstall to sync the lockfile**

Run (from the repo root): `bun install`
Expected: exits 0, `bun.lock` updates to drop the two removed packages and reflect `radix-ui`.

- [ ] **Step 7: Re-run type-check and full suite one more time**

Run: `cd packages/web && bunx tsc --noEmit && bun run test`
Expected: no errors, all tests still passing (confirms removing the old packages from `package.json` didn't break anything, i.e. nothing else was still relying on them being hoisted).

- [ ] **Step 8: Stage the changes**

```bash
git add packages/web/components/ui/button.tsx packages/web/components/added-to-cart-modal.tsx packages/web/package.json bun.lock
git status
```

**Do not commit.**

---

### Task 2: Add the `DropdownMenu` primitive and rewrite `SortSelect`

**Files:**

- Create (via CLI): `packages/web/components/ui/dropdown-menu.tsx`
- Modify: `packages/web/package.json` (dependencies — `lucide-react`, `@testing-library/user-event`)
- Modify: `bun.lock` (via `bun install`)
- Modify: `packages/web/tests/component/setup.ts`
- Modify: `packages/web/components/sort-select.tsx`
- Modify: `packages/web/tests/component/product-filters.test.tsx`
- Modify: `packages/web/tests/component/product-listing-page.test.tsx:69`

**Interfaces:**

- Consumes: `Button` from `packages/web/components/ui/button.tsx` (Task 1 — same API, `variant`/`size`/`asChild` props). `PRODUCT_CATEGORIES` is not touched by this task.
- Produces: `SortSelect` — same export name, same "no props" signature, same rendered-inside-`ProductFilters` usage as before. `ProductFilters` (`product-filters.tsx`) is not modified by this task — it already just renders `<SortSelect />` with no knowledge of its internals, so no change is needed there.

- [ ] **Step 1: Scaffold the `dropdown-menu` primitive**

Run (from `packages/web`):

```bash
cd packages/web
bunx shadcn@latest add dropdown-menu --yes
```

Expected: creates `packages/web/components/ui/dropdown-menu.tsx`, adds `lucide-react` to `packages/web/package.json` dependencies.

- [ ] **Step 2: Verify the generated primitive**

Read `packages/web/components/ui/dropdown-menu.tsx`. Confirm it:

- Imports its Radix primitive from `"radix-ui"` (the unified package, consistent with Task 1's migration — not from a scoped `@radix-ui/react-dropdown-menu` package).
- Exports at minimum: `DropdownMenu`, `DropdownMenuTrigger`, `DropdownMenuContent`, `DropdownMenuRadioGroup`, `DropdownMenuRadioItem`.
- Uses the same `data-slot="..."` + `cn()` convention as `button.tsx`.

If it imports from a scoped `@radix-ui/react-dropdown-menu` package instead of `radix-ui`, stop and report — that would mean the installed shadcn CLI version doesn't match what was verified during planning (see the design spec's context7 lookup), and needs a decision before proceeding rather than silently diverging from Task 1's consistency goal.

- [ ] **Step 3: Add `@testing-library/user-event`**

Run: `cd packages/web && bun add -D @testing-library/user-event`
Expected: exits 0, adds the package to `packages/web/package.json` devDependencies and updates `bun.lock`.

- [ ] **Step 4: Add jsdom polyfills for Radix's `DropdownMenu`**

Edit `packages/web/tests/component/setup.ts`. Replace:

```ts
import "@testing-library/jest-dom/vitest";
import { afterAll, afterEach, beforeAll } from "vitest";
import { cleanup } from "@testing-library/react";
import { setupServer } from "msw/node";
import { handlers } from "./msw-handlers";

export const server = setupServer(...handlers);
```

with:

```ts
import "@testing-library/jest-dom/vitest";
import { afterAll, afterEach, beforeAll } from "vitest";
import { cleanup } from "@testing-library/react";
import { setupServer } from "msw/node";
import { handlers } from "./msw-handlers";

// Radix's DropdownMenu relies on pointer-capture APIs jsdom doesn't
// implement; without these, its trigger never opens in tests.
Element.prototype.hasPointerCapture ??= () => false;
Element.prototype.releasePointerCapture ??= () => {};
Element.prototype.scrollIntoView ??= () => {};

export const server = setupServer(...handlers);
```

(The rest of the file — `beforeAll`/`afterEach`/`afterAll` — is unchanged.)

- [ ] **Step 5: Write the failing test — rewrite the three sort tests in `product-filters.test.tsx`**

Edit `packages/web/tests/component/product-filters.test.tsx`. Replace the import line:

```tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ProductFilters } from "@/components/product-filters";
```

with:

```tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ProductFilters } from "@/components/product-filters";
```

Then replace the three sort-related tests:

```tsx
it("navigates with the chosen sort and clears page", () => {
  mockSearchParams = "page=3";
  render(<ProductFilters activeCategory={undefined} />);

  fireEvent.change(screen.getByLabelText("Sort products"), {
    target: { value: "price_asc" },
  });

  expect(push).toHaveBeenCalledWith("/?sort=price_asc");
});

it("preserves the category param when changing sort", () => {
  mockSearchParams = "category=Footwear";
  render(<ProductFilters activeCategory="Footwear" />);

  fireEvent.change(screen.getByLabelText("Sort products"), {
    target: { value: "price_desc" },
  });

  expect(push).toHaveBeenCalledWith("/?category=Footwear&sort=price_desc");
});

it("removes the sort param when Featured is selected", () => {
  mockSearchParams = "sort=price_asc";
  render(<ProductFilters activeCategory={undefined} />);

  fireEvent.change(screen.getByLabelText("Sort products"), {
    target: { value: "" },
  });

  expect(push).toHaveBeenCalledWith("/");
});
```

with:

```tsx
it("navigates with the chosen sort and clears page", async () => {
  mockSearchParams = "page=3";
  render(<ProductFilters activeCategory={undefined} />);

  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: /^Sort:/ }));
  await user.click(
    screen.getByRole("menuitemradio", { name: "Price: Low to High" }),
  );

  expect(push).toHaveBeenCalledWith("/?sort=price_asc");
});

it("preserves the category param when changing sort", async () => {
  mockSearchParams = "category=Footwear";
  render(<ProductFilters activeCategory="Footwear" />);

  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: /^Sort:/ }));
  await user.click(
    screen.getByRole("menuitemradio", { name: "Price: High to Low" }),
  );

  expect(push).toHaveBeenCalledWith("/?category=Footwear&sort=price_desc");
});

it("removes the sort param when Featured is selected", async () => {
  mockSearchParams = "sort=price_asc";
  render(<ProductFilters activeCategory={undefined} />);

  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: /^Sort:/ }));
  await user.click(screen.getByRole("menuitemradio", { name: "Featured" }));

  expect(push).toHaveBeenCalledWith("/");
});
```

The other four tests in this file (`renders a link for each category plus All`, `preserves the active sort in category link hrefs`, `marks the active category link with aria-current`, `marks All as active when no category is selected`) are unchanged — they don't interact with the sort control.

- [ ] **Step 6: Also fix `product-listing-page.test.tsx`'s dependency on the old label**

`packages/web/tests/component/product-listing-page.test.tsx:69` also queries the sort control, via the native `<select>`'s `aria-label="Sort products"`, which won't exist once Step 8 replaces it with a button. Edit that file, replacing:

```tsx
expect(screen.getByLabelText("Sort products")).toBeInTheDocument();
```

with:

```tsx
expect(screen.getByRole("button", { name: /^Sort:/ })).toBeInTheDocument();
```

- [ ] **Step 7: Run the tests to verify they fail**

Run: `cd packages/web && bun run test -- product-filters` and `cd packages/web && bun run test -- product-listing-page`
Expected: both FAIL — `getByRole("button", { name: /^Sort:/ })` finds nothing in either file, since `sort-select.tsx` still renders a native `<select>`, not a button with that text.

- [ ] **Step 8: Rewrite `sort-select.tsx`**

Replace the entire contents of `packages/web/components/sort-select.tsx`:

```tsx
"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { ChevronDownIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const SORT_OPTIONS = [
  { value: "", label: "Featured" },
  { value: "category", label: "Category (A–Z)" },
  { value: "price_asc", label: "Price: Low to High" },
  { value: "price_desc", label: "Price: High to Low" },
] as const;

export function SortSelect() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const currentSort = searchParams.get("sort") ?? "";
  const currentLabel =
    SORT_OPTIONS.find((o) => o.value === currentSort)?.label ?? "Featured";

  function handleChange(value: string) {
    const params = new URLSearchParams(searchParams);
    params.delete("page");
    if (value) {
      params.set("sort", value);
    } else {
      params.delete("sort");
    }
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm">
          Sort: {currentLabel}
          <ChevronDownIcon />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuRadioGroup
          value={currentSort}
          onValueChange={handleChange}
        >
          {SORT_OPTIONS.map((option) => (
            <DropdownMenuRadioItem key={option.value} value={option.value}>
              {option.label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
```

- [ ] **Step 9: Run the tests to verify they pass**

Run: `cd packages/web && bun run test -- product-filters` and `cd packages/web && bun run test -- product-listing-page`
Expected: both PASS — 7/7 in `product-filters.test.tsx`, 5/5 in `product-listing-page.test.tsx`.

- [ ] **Step 10: Run the full web suite**

Run: `cd packages/web && bun run test`
Expected: all tests pass — same total as after Task 1, since this task only rewrote 3 existing test cases plus 1 assertion (no net change in test count) and added no new test files.

- [ ] **Step 11: Manual verification against the real dev server**

With `bun run dev:web` (and `dev:api`) running: visit `http://localhost:3000/`, confirm the sort control now renders as a button reading "Sort: Featured" with a chevron. Click it — confirm a menu opens with the 4 options and a filled dot next to "Featured". Click "Price: Low to High" — confirm the menu closes, the URL gains `?sort=price_asc`, products reorder by ascending price, and the trigger button now reads "Sort: Price: Low to High". Click a category pill — confirm the sort is preserved in the URL (per the existing `preserves the active sort in category link hrefs` behavior, unchanged by this plan).

- [ ] **Step 12: Stage the changes**

```bash
git add packages/web/components/ui/dropdown-menu.tsx packages/web/package.json bun.lock packages/web/tests/component/setup.ts packages/web/components/sort-select.tsx packages/web/tests/component/product-filters.test.tsx packages/web/tests/component/product-listing-page.test.tsx
git status
```

**Do not commit.**
