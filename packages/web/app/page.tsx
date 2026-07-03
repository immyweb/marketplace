import type { Metadata } from "next";
import { fetchProducts } from "@/lib/api";
import { ProductCard } from "@/components/product-card";

export const metadata: Metadata = {
  title: "Shop All Products",
  description: "Browse our full range of clothing and accessories.",
  openGraph: {
    title: "Shop All Products",
    description: "Browse our full range of clothing and accessories.",
  },
};

export default async function ProductListingPage() {
  const { results } = await fetchProducts();

  if (results.length === 0) {
    return (
      <>
        <h1 className="text-2xl font-semibold">All Products</h1>
        <p className="mt-4 text-muted-foreground">No products available.</p>
      </>
    );
  }

  return (
    <>
      <p className="font-mono text-xs tracking-widest text-muted-foreground uppercase">
        Full Catalog · {results.length} Goods
      </p>
      <h1 className="mt-1 text-2xl">All Products</h1>
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
    </>
  );
}
