# Sort Control: Native `<select>` → shadcn Dropdown Menu

## Problem

The PLP's sort control (`packages/web/components/sort-select.tsx`) is a native `<select>` styled with plain Tailwind classes. The rest of this codebase's interactive primitives follow the shadcn/ui pattern (`components/ui/button.tsx`, `components.json` already configured with style `new-york` and `iconLibrary: lucide`), but no dropdown-menu primitive exists yet. Replace the native select with a shadcn `DropdownMenu`, matching the established primitive convention.

## Goals

- Swap the native `<select>` for a shadcn-generated `DropdownMenu`.
- Trigger button shows the currently active sort option's label (e.g. "Sort: Price: Low to High"), defaulting to "Sort: Featured" when no `sort` param is active.
- The four sort options (Featured, Category (A–Z), Price: Low to High, Price: High to Low) render as a `DropdownMenuRadioGroup`/`DropdownMenuRadioItem` set — exactly one is always active, matching existing radio semantics.
- Selecting an option produces the exact same navigation behavior as today: clear `page`, set/clear `sort`, preserve `category`, `router.push`.

## Non-Goals

- No change to `ProductFilters`' category pills — untouched.
- No change to the underlying `GET /products` API, `fetchProducts`, or `app/page.tsx` — this is a presentation-only swap of the sort control's markup.
- No multi-select or search-within-dropdown — still exactly one active sort at a time.

## Design

### New primitive: `components/ui/dropdown-menu.tsx`

Scaffolded via the shadcn CLI (`bunx shadcn@latest add dropdown-menu`, run from `packages/web`) — the standard generated output (`DropdownMenu`, `DropdownMenuTrigger`, `DropdownMenuContent`, `DropdownMenuRadioGroup`, `DropdownMenuRadioItem`, plus the other exports the CLI always includes: `DropdownMenuLabel`, `DropdownMenuSeparator`, `DropdownMenuItem`, `DropdownMenuCheckboxItem`, `DropdownMenuShortcut`, `DropdownMenuGroup`, `DropdownMenuPortal`, `DropdownMenuSub`, `DropdownMenuSubContent`, `DropdownMenuSubTrigger`). Not hand-written — this is boilerplate the CLI generates, following the same `data-slot` + `cn()` conventions as `button.tsx`. Adds `lucide-react` to `packages/web/package.json` dependencies (shadcn's icon library, already declared as this project's choice in `components.json`).

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

Radix's `DropdownMenu` (built on `@radix-ui/react-popper` + pointer-capture-based interaction) doesn't open in jsdom without these — a known gap distinct from `@radix-ui/react-dialog` (already used for the add-to-cart modal), which doesn't hit it. `??=` guards against jsdom versions that already implement these.

**`product-filters.test.tsx`** — the three sort-related tests (`navigates with the chosen sort and clears page`, `preserves the category param when changing sort`, `removes the sort param when Featured is selected`) are rewritten from `fireEvent.change(getByLabelText("Sort products"), ...)` to:

```tsx
fireEvent.click(screen.getByRole("button", { name: /^Sort:/ }));
fireEvent.click(
  screen.getByRole("menuitemradio", { name: "Price: Low to High" }),
);
```

The category-link tests (`renders a link for each category plus All`, `preserves the active sort...`, `marks the active category...`, `marks All as active...`) are untouched — they don't interact with the sort control.

## Testing (feature-level)

Same 7 test cases as today (4 category-link tests unchanged, 3 sort tests rewritten for the new interaction pattern per above), all still exercising real component behavior (no mocking of `DropdownMenu` itself — only `next/navigation`, per the existing pattern). No new E2E test — sort control interaction isn't a checkout/cart/payment critical flow per ADR 001.
