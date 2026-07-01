import type { Metadata } from 'next';
import { fetchProducts } from '@/lib/api';
import { ProductCard } from '@/components/product-card';

export const metadata: Metadata = {
  title: 'Shop All Products',
  description: 'Browse our full range of clothing and accessories.'
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
      <h1 className="text-2xl font-semibold">All Products</h1>
      <ul
        aria-label="Product listing"
        className="mt-6 grid list-none grid-cols-2 gap-6 p-0 sm:grid-cols-3">
        {results.map((product) => (
          <li key={product.id}>
            <ProductCard {...product} />
          </li>
        ))}
      </ul>
    </>
  );
}
