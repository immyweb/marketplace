import type { Metadata } from "next";
import { fetchProducts } from "@/lib/api";
import { Pagination } from "@/components/ui/pagination";
import {
  ProductCard,
  ProductFilters,
  ProductSearch,
} from "@/app/products/_components";
import { buildProductsHref } from "@/app/products/_components/product-href";

export const metadata: Metadata = {
  title: "Shop All Products",
  description: "Browse our full range of clothing and accessories.",
  openGraph: {
    title: "Shop All Products",
    description: "Browse our full range of clothing and accessories.",
  },
};

interface Props {
  searchParams: Promise<{
    page?: string;
    sort?: string;
    category?: string;
    q?: string;
  }>;
}

export default async function ProductListingPage({ searchParams }: Props) {
  const { page, sort, category, q } = await searchParams;
  const currentPage = page ? Number(page) : 1;
  const { results, total, totalPages } = await fetchProducts({
    page: currentPage,
    sort,
    category,
    q,
  });

  return (
    <>
      <p className="font-mono text-xs tracking-widest text-muted-foreground uppercase">
        Full Catalog · {total} Goods
      </p>
      <h1 className="mt-1 text-2xl">All Products</h1>
      <ProductSearch />
      {q ? null : <ProductFilters activeCategory={category} sort={sort} />}
      {results.length === 0 ? (
        <p className="mt-8 text-muted-foreground">
          {q
            ? `No results for "${q}".`
            : category
              ? "No products in this category."
              : "No products available."}
        </p>
      ) : (
        <>
          <ul
            aria-label="Product listing"
            className="mt-8 grid list-none grid-cols-2 gap-x-6 gap-y-10 p-0 sm:grid-cols-3 lg:grid-cols-4"
          >
            {results.map((product, index) => (
              <li key={product.id}>
                <ProductCard {...product} eager={index < 3} />
              </li>
            ))}
          </ul>
          <Pagination
            page={currentPage}
            totalPages={totalPages}
            buildHref={(p) => buildProductsHref({ page: p, sort, category })}
          />
        </>
      )}
    </>
  );
}
