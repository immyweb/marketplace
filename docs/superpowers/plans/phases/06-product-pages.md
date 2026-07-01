> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Phase 6 — Product Pages** | [link to overview](../2026-06-30-marketplace.md)

**Global Constraints:** See [overview](../2026-06-30-marketplace.md#global-constraints) — all constraints apply here.

---

## Phase 6 — Product Pages

### Task 17: Product Listing Page (PLP)

**Files:**

- Create: `packages/web/components/product-card.tsx`
- Modify: `packages/web/app/page.tsx`

**Interfaces:**

- Consumes: `fetchProducts()` → `{ results: Product[] }`
- Produces: SSR page at `/` displaying a grid of product cards

- [ ] **Step 1: Create `packages/web/components/product-card.tsx`**

```typescript
import Image from 'next/image'
import Link from 'next/link'

interface Props {
  id: number
  name: string
  primary_image: string
  unit_price: number
  currency: string
}

export function ProductCard({ id, name, primary_image, unit_price, currency }: Props) {
  return (
    <article>
      <Link href={`/products/${id}`}>
        <Image
          src={primary_image}
          alt={name}
          width={400}
          height={400}
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
          style={{ width: '100%', height: 'auto', aspectRatio: '1 / 1', objectFit: 'cover' }}
        />
        <h2>{name}</h2>
        <p aria-label={`Price: ${currency} ${unit_price.toFixed(2)}`}>
          {currency === 'GBP' ? '£' : currency}{unit_price.toFixed(2)}
        </p>
      </Link>
    </article>
  )
}
```

- [ ] **Step 2: Update `packages/web/app/page.tsx`**

```typescript
import type { Metadata } from 'next'
import { fetchProducts } from '@/lib/api'
import { ProductCard } from '@/components/product-card'

export const metadata: Metadata = {
  title: 'Shop All Products',
  description: 'Browse our full range of clothing and accessories.',
}

export default async function ProductListingPage() {
  const { results } = await fetchProducts()

  return (
    <>
      <h1>All Products</h1>
      {results.length === 0 ? (
        <p>No products available.</p>
      ) : (
        <ul aria-label="Product listing" style={{ display: 'grid', listStyle: 'none', padding: 0 }}>
          {results.map((product) => (
            <li key={product.id}>
              <ProductCard {...product} />
            </li>
          ))}
        </ul>
      )}
    </>
  )
}
```

- [ ] **Step 3: Seed products and verify in browser**

```bash
bun run --filter api db:seed
```

Visit `http://localhost:3000`. Expected: grid of 6 product cards with names and prices.

---

### Task 18: Product Detail Page (PDP)

**Files:**

- Create: `packages/web/components/product-gallery.tsx`
- Create: `packages/web/components/add-to-cart-button.tsx`
- Create: `packages/web/app/products/[id]/page.tsx`

**Interfaces:**

- Consumes: `fetchProduct(id)` → full `Product`
- Produces: SSR page at `/products/:id` with image gallery, description, price, and add-to-cart button

- [ ] **Step 1: Create `packages/web/components/product-gallery.tsx`**

```typescript
'use client'

import Image from 'next/image'
import { useState } from 'react'

interface Props {
  images: string[]
  productName: string
}

export function ProductGallery({ images, productName }: Props) {
  const [selected, setSelected] = useState(0)

  return (
    <div>
      <Image
        src={images[selected]}
        alt={productName}
        width={800}
        height={800}
        priority
        style={{ width: '100%', height: 'auto', objectFit: 'cover' }}
      />
      {images.length > 1 && (
        <div role="list" aria-label="Product images">
          {images.map((src, i) => (
            <button
              key={src}
              role="listitem"
              onClick={() => setSelected(i)}
              aria-label={`View image ${i + 1}`}
              aria-pressed={selected === i}
            >
              <Image
                src={src}
                alt={`${productName} view ${i + 1}`}
                width={80}
                height={80}
                style={{ objectFit: 'cover' }}
              />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Create `packages/web/components/add-to-cart-button.tsx`**

```typescript
'use client'

import { useState } from 'react'
import { addToCart } from '@/lib/api'
import { useRouter } from 'next/navigation'

interface Props {
  productId: number
}

export function AddToCartButton({ productId }: Props) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  async function handleClick() {
    setLoading(true)
    setError(null)
    try {
      await addToCart(productId, 1)
      router.refresh() // re-fetches Nav to update cart badge
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add to cart')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <button onClick={handleClick} disabled={loading} aria-busy={loading}>
        {loading ? 'Adding...' : 'Add to Cart'}
      </button>
      {error && <p role="alert">{error}</p>}
    </div>
  )
}
```

- [ ] **Step 3: Create `packages/web/app/products/[id]/page.tsx`**

```typescript
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { fetchProduct } from '@/lib/api'
import { ProductGallery } from '@/components/product-gallery'
import { AddToCartButton } from '@/components/add-to-cart-button'

interface Props {
  params: Promise<{ id: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params
  const product = await fetchProduct(parseInt(id, 10)).catch(() => null)
  if (!product) return {}
  return {
    title: product.name,
    description: product.description,
    openGraph: {
      title: product.name,
      description: product.description,
      images: [product.primary_image],
    },
  }
}

export default async function ProductDetailPage({ params }: Props) {
  const { id } = await params
  const product = await fetchProduct(parseInt(id, 10)).catch(() => null)

  if (!product) notFound()

  return (
    <article aria-label={product.name}>
      <ProductGallery images={product.image_urls} productName={product.name} />
      <div>
        <h1>{product.name}</h1>
        <p>{product.description}</p>
        <p aria-label={`Price: £${product.unit_price.toFixed(2)}`}>
          £{product.unit_price.toFixed(2)}
        </p>
        <AddToCartButton productId={product.id} />
      </div>
    </article>
  )
}
```

- [ ] **Step 4: Verify in browser**

Visit `http://localhost:3000/products/1`. Expected: product image gallery, name, description, price, "Add to Cart" button. Clicking "Add to Cart" updates the nav badge.
