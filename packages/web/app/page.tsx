import type { Metadata } from "next";
import { fetchProducts } from "@/lib/api";
import { ProductCard } from "@/components/product-card";
import { ProductFilters } from "@/components/product-filters";
import { Pagination } from "@/components/pagination";

export const metadata: Metadata = {
  title: "Shop All Products",
  description: "Browse our full range of clothing and accessories.",
  openGraph: {
    title: "Shop All Products",
    description: "Browse our full range of clothing and accessories.",
  },
};

interface Props {
  searchParams: Promise<{ page?: string; sort?: string; category?: string }>;
}

export default async function ProductListingPage({ searchParams }: Props) {
  const { page, sort, category } = await searchParams;
  const currentPage = page ? Number(page) : 1;
  const { results, total, totalPages } = await fetchProducts({
    page: currentPage,
    sort,
    category,
  });

  return (
    <>
      <p className="font-mono text-xs tracking-widest text-muted-foreground uppercase">
        Full Catalog · {total} Goods
      </p>
      <h1 className="mt-1 text-2xl">All Products</h1>
      <ProductFilters activeCategory={category} sort={sort} />
      {results.length === 0 ? (
        <p className="mt-8 text-muted-foreground">
          {category
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
            sort={sort}
            category={category}
          />
        </>
      )}
    </>
  );
}
