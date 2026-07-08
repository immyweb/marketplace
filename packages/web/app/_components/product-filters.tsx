import Link from "next/link";
import { PRODUCT_CATEGORIES } from "@marketplace/core";
import { SortSelect } from "./sort-select";
import { buildProductsHref } from "./product-href";

interface Props {
  activeCategory?: string;
  sort?: string;
}

export function ProductFilters({ activeCategory, sort }: Props) {
  return (
    <div className="mt-6 flex flex-wrap items-center justify-between gap-4">
      <nav aria-label="Filter by category" className="flex flex-wrap gap-2">
        <Link
          href={buildProductsHref({ sort })}
          aria-current={!activeCategory ? "true" : undefined}
          className={`rounded-full border px-3 py-1 text-sm ${
            !activeCategory
              ? "border-primary bg-primary text-primary-foreground"
              : "border-border text-muted-foreground hover:border-primary hover:bg-primary hover:text-primary-foreground"
          }`}
        >
          All
        </Link>
        {PRODUCT_CATEGORIES.map((category) => (
          <Link
            key={category}
            href={buildProductsHref({ sort, category })}
            aria-current={activeCategory === category ? "true" : undefined}
            className={`rounded-full border px-3 py-1 text-sm ${
              activeCategory === category
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border text-muted-foreground hover:border-primary hover:bg-primary hover:text-primary-foreground"
            }`}
          >
            {category}
          </Link>
        ))}
      </nav>
      <SortSelect />
    </div>
  );
}
