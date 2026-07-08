"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { ChevronDownIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { buildProductsHref } from "./product-href";

const SORT_OPTIONS = [
  { value: "", label: "Featured" },
  { value: "category", label: "Category (A–Z)" },
  { value: "price_asc", label: "Price: Low to High" },
  { value: "price_desc", label: "Price: High to Low" },
] as const;

export function SortSelect() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const currentSort = searchParams.get("sort") ?? "";
  const currentCategory = searchParams.get("category") ?? undefined;
  const currentLabel =
    SORT_OPTIONS.find((o) => o.value === currentSort)?.label ?? "Featured";

  function handleChange(value: string) {
    router.push(buildProductsHref({ sort: value, category: currentCategory }));
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="rounded-full text-muted-foreground hover:bg-primary hover:text-primary-foreground"
        >
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
