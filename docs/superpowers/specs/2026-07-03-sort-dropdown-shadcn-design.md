# Sort Control: Native `<select>` → shadcn Dropdown Menu

## Problem

The PLP's sort control (`packages/web/components/sort-select.tsx`) is a native `<select>` styled with plain Tailwind classes. The rest of this codebase's interactive primitives follow the shadcn/ui pattern (`components/ui/button.tsx`, `components.json` already configured with style `new-york` and `iconLibrary: lucide`), but no dropdown-menu primitive exists yet. Replace the native select with a shadcn `DropdownMenu`, matching the established primitive convention.

**Scope note:** `button.tsx` (`@radix-ui/react-slot`) and `added-to-cart-modal.tsx`'s Dialog (`@radix-ui/react-dialog`) were both built before shadcn's Feb 2026 change to the `new-york` style, which now generates components importing from a single unified `radix-ui` package instead of individual scoped `@radix-ui/react-*` packages. Since this is a new project with no reason to carry that historical split, and the user wants one consistent convention, this plan also migrates those two existing components to the unified package (via shadcn's own `migrate radix` CLI command) as part of adding the new dropdown-menu — not a separate cleanup effort.

## Goals

- Swap the native `<select>` for a shadcn-generated `DropdownMenu`.
- Trigger button shows the currently active sort option's label (e.g. "Sort: Price: Low to High"), defaulting to "Sort: Featured" when no `sort` param is active.
- The four sort options (Featured, Category (A–Z), Price: Low to High, Price: High to Low) render as a `DropdownMenuRadioGroup`/`DropdownMenuRadioItem` set — exactly one is always active, matching existing radio semantics.
- Selecting an option produces the exact same navigation behavior as today: clear `page`, set/clear `sort`, preserve `category`, `router.push`.
- All of this project's shadcn/Radix primitives (`button.tsx`, the add-to-cart `Dialog`, and the new `dropdown-menu`) import from the single unified `radix-ui` package — no mixed scoped/unified imports across `components/`.
- `package.json` ends up with one Radix dependency (`radix-ui`) instead of two (`@radix-ui/react-slot`, `@radix-ui/react-dialog`), plus `lucide-react` (new, for the dropdown's icons).

## Non-Goals

- No change to `ProductFilters`' category pills — untouched.
- No change to the underlying `GET /products` API, `fetchProducts`, or `app/page.tsx` — this is a presentation-only swap of the sort control's markup.
- No multi-select or search-within-dropdown — still exactly one active sort at a time.
- No behavioral change to `Button` or `AddedToCartModal` — the migration only changes their internal import source (`@radix-ui/react-slot`/`@radix-ui/react-dialog` → `radix-ui`), not their props, styling, or behavior.

## Design

### Migrating existing primitives to the unified `radix-ui` package

Run shadcn's own migration command from `packages/web`: `bunx shadcn@latest migrate radix --path components`. This rewrites the imports in both `components/ui/button.tsx` (`@radix-ui/react-slot` → `radix-ui`'s `Slot` export) and `components/added-to-cart-modal.tsx` (`@radix-ui/react-dialog` → `radix-ui`'s `Dialog` export, following the confirmed pattern `import { Dialog as DialogPrimitive } from "radix-ui"`), and adds `radix-ui` to `package.json` dependencies. Component props/behavior (`asChild`, `Dialog.Root`/`Dialog.Portal`/etc. sub-components) are unaffected — only the import source changes. After migrating, `@radix-ui/react-slot` and `@radix-ui/react-dialog` become unused and are removed from `package.json` dependencies manually (the CLI doesn't do this step automatically).

### New primitive: `components/ui/dropdown-menu.tsx`

Scaffolded via the shadcn CLI (`bunx shadcn@latest add dropdown-menu`, run from `packages/web`, after the migration above so it lands on the unified package like its siblings) — the standard generated output (`DropdownMenu`, `DropdownMenuTrigger`, `DropdownMenuContent`, `DropdownMenuRadioGroup`, `DropdownMenuRadioItem`, plus the other exports the CLI always includes: `DropdownMenuLabel`, `DropdownMenuSeparator`, `DropdownMenuItem`, `DropdownMenuCheckboxItem`, `DropdownMenuShortcut`, `DropdownMenuGroup`, `DropdownMenuPortal`, `DropdownMenuSub`, `DropdownMenuSubContent`, `DropdownMenuSubTrigger`). Not hand-written — this is boilerplate the CLI generates, following the same `data-slot` + `cn()` conventions as `button.tsx`. Adds `lucide-react` to `packages/web/package.json` dependencies (shadcn's icon library, already declared as this project's choice in `components.json`).

### `sort-select.tsx` rewrite

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

No separate "Sort by" text label — the trigger button's own text ("Sort: {label}") is its accessible name, so screen readers announce the current state without needing an `aria-label` override (an explicit `aria-label` would replace the visible text as the accessible name for assistive tech, hiding the current selection — deliberately avoided).

`ProductFilters` (`product-filters.tsx`) is unchanged — it already just renders `<SortSelect />` as a child, with no knowledge of its internals.

### Testing

**`tests/component/setup.ts`** gains a polyfill block, applied once for all component tests:

```ts
Element.prototype.hasPointerCapture ??= () => false;
Element.prototype.releasePointerCapture ??= () => {};
Element.prototype.scrollIntoView ??= () => {};
```

Radix's `DropdownMenu` (built on Popper + pointer-capture-based interaction) doesn't open in jsdom without these — a known gap distinct from the `Dialog` (already used for the add-to-cart modal), which doesn't hit it. `??=` guards against jsdom versions that already implement these.

**`product-filters.test.tsx`** — the three sort-related tests (`navigates with the chosen sort and clears page`, `preserves the category param when changing sort`, `removes the sort param when Featured is selected`) are rewritten from `fireEvent.change(getByLabelText("Sort products"), ...)` to use `@testing-library/user-event` (new devDependency) instead of `fireEvent.click`: Radix's `DropdownMenuTrigger` opens on `pointerdown`, which `fireEvent.click` alone doesn't reliably synthesize, while `userEvent.click` fires the full pointer/mouse event sequence real browsers produce.

```tsx
const user = userEvent.setup();
await user.click(screen.getByRole("button", { name: /^Sort:/ }));
await user.click(
  screen.getByRole("menuitemradio", { name: "Price: Low to High" }),
);
```

The category-link tests (`renders a link for each category plus All`, `preserves the active sort...`, `marks the active category...`, `marks All as active...`) are untouched — they don't interact with the sort control, and keep using `fireEvent`/plain assertions.

### Migration testing

Migrating `button.tsx` and `added-to-cart-modal.tsx` to the unified `radix-ui` package changes only their import source, not props or behavior — the existing tests that already cover them (`added-to-cart-modal.test.tsx`, and any component test rendering a `Button`) are expected to keep passing unmodified and serve as the regression check for the migration; no new tests are written for it.

## Testing (feature-level)

Same 7 test cases as today for `ProductFilters`/`SortSelect` (4 category-link tests unchanged, 3 sort tests rewritten for the new interaction pattern per above), all still exercising real component behavior (no mocking of `DropdownMenu` itself — only `next/navigation`, per the existing pattern), plus the full existing web suite passing unmodified as the migration's regression check. No new E2E test — sort control interaction isn't a checkout/cart/payment critical flow per ADR 001.
