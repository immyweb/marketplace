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
        <h1>All Products</h1>
        <p>No products available.</p>
      </>
    );
  }

  return (
    <>
      <h1>All Products</h1>
      <ul
        aria-label="Product listing"
        style={{ display: 'grid', listStyle: 'none', padding: 0 }}>
        {results.map((product) => (
          <li key={product.id}>
            <ProductCard {...product} />
          </li>
        ))}
      </ul>
    </>
  );
}
