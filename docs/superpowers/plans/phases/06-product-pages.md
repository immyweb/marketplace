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

---

### Task 19: Tailwind CSS + shadcn/ui Setup

**Files:**

- Create: `packages/web/postcss.config.mjs`
- Create: `packages/web/app/globals.css`
- Create: `packages/web/global.d.ts`
- Modify: `packages/web/app/layout.tsx`
- Create: `packages/web/components.json`
- Create: `packages/web/lib/utils.ts`
- Create: `packages/web/components/ui/button.tsx`
- Modify: `packages/web/package.json` (new dependencies below)

**Interfaces:**

- Consumes: nothing from earlier tasks
- Produces: Tailwind utility classes available project-wide via `app/globals.css`; `cn()` from `packages/web/lib/utils.ts`; `<Button>`/`buttonVariants` from `packages/web/components/ui/button.tsx` — later tasks (20, 22) use these

> This task only installs and wires up the tooling, plus one component (`Button`) to prove the setup end-to-end. It does not touch any already-built page or component — that's Task 20.

- [ ] **Step 1: Install Tailwind CSS and the packages `button.tsx` needs**

```bash
cd packages/web
bun add -d tailwindcss @tailwindcss/postcss postcss
bun add @radix-ui/react-slot class-variance-authority clsx tailwind-merge
```

- [ ] **Step 2: Create `packages/web/postcss.config.mjs`**

```javascript
const config = {
  plugins: {
    "@tailwindcss/postcss": {},
  },
};

export default config;
```

- [ ] **Step 3: Create `packages/web/app/globals.css`**

```css
@import "tailwindcss";

@custom-variant dark (&:is(.dark *));

@theme inline {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --color-card: var(--card);
  --color-card-foreground: var(--card-foreground);
  --color-popover: var(--popover);
  --color-popover-foreground: var(--popover-foreground);
  --color-primary: var(--primary);
  --color-primary-foreground: var(--primary-foreground);
  --color-secondary: var(--secondary);
  --color-secondary-foreground: var(--secondary-foreground);
  --color-muted: var(--muted);
  --color-muted-foreground: var(--muted-foreground);
  --color-accent: var(--accent);
  --color-accent-foreground: var(--accent-foreground);
  --color-destructive: var(--destructive);
  --color-border: var(--border);
  --color-input: var(--input);
  --color-ring: var(--ring);
  --radius-sm: calc(var(--radius) * 0.6);
  --radius-md: calc(var(--radius) * 0.8);
  --radius-lg: var(--radius);
  --radius-xl: calc(var(--radius) * 1.4);
}

:root {
  --radius: 0.625rem;
  --background: oklch(1 0 0);
  --foreground: oklch(0.145 0 0);
  --card: oklch(1 0 0);
  --card-foreground: oklch(0.145 0 0);
  --popover: oklch(1 0 0);
  --popover-foreground: oklch(0.145 0 0);
  --primary: oklch(0.205 0 0);
  --primary-foreground: oklch(0.985 0 0);
  --secondary: oklch(0.97 0 0);
  --secondary-foreground: oklch(0.205 0 0);
  --muted: oklch(0.97 0 0);
  --muted-foreground: oklch(0.556 0 0);
  --accent: oklch(0.97 0 0);
  --accent-foreground: oklch(0.205 0 0);
  --destructive: oklch(0.577 0.245 27.325);
  --border: oklch(0.922 0 0);
  --input: oklch(0.922 0 0);
  --ring: oklch(0.708 0 0);
}

.dark {
  --background: oklch(0.145 0 0);
  --foreground: oklch(0.985 0 0);
  --card: oklch(0.205 0 0);
  --card-foreground: oklch(0.985 0 0);
  --popover: oklch(0.205 0 0);
  --popover-foreground: oklch(0.985 0 0);
  --primary: oklch(0.922 0 0);
  --primary-foreground: oklch(0.205 0 0);
  --secondary: oklch(0.269 0 0);
  --secondary-foreground: oklch(0.985 0 0);
  --muted: oklch(0.269 0 0);
  --muted-foreground: oklch(0.708 0 0);
  --accent: oklch(0.269 0 0);
  --accent-foreground: oklch(0.985 0 0);
  --destructive: oklch(0.704 0.191 22.216);
  --border: oklch(1 0 0 / 10%);
  --input: oklch(1 0 0 / 15%);
  --ring: oklch(0.556 0 0);
}

@layer base {
  * {
    @apply border-border outline-ring/50;
  }

  body {
    @apply bg-background text-foreground;
  }
}
```

> No `tailwind.config.ts` — Tailwind v4 configures itself via the `@theme inline` block above. Only the `neutral` base-color tokens actually used by `Button` are included; add more (`--color-chart-*`, `--color-sidebar-*`, etc.) only when a component that needs them is added, per YAGNI.

- [ ] **Step 4: Import `globals.css` in `packages/web/app/layout.tsx`**

```typescript
import './globals.css'
import type { Metadata } from 'next'
import { Nav } from '@/components/nav'

export const metadata: Metadata = {
  title: { default: 'Marketplace', template: '%s | Marketplace' },
  description: 'Quality clothing and accessories.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Nav />
        <main id="main-content">{children}</main>
      </body>
    </html>
  )
}
```

> Global CSS import goes first, before other imports — Next.js convention for the root layout, keeps CSS chunk ordering predictable as more styles are added later.

- [ ] **Step 5: Create `packages/web/components.json`**

```json
{
  "$schema": "https://ui.shadcn.com/schema.json",
  "style": "new-york",
  "rsc": true,
  "tsx": true,
  "tailwind": {
    "config": "",
    "css": "app/globals.css",
    "baseColor": "neutral",
    "cssVariables": true,
    "prefix": ""
  },
  "aliases": {
    "components": "@/components",
    "utils": "@/lib/utils",
    "ui": "@/components/ui",
    "lib": "@/lib",
    "hooks": "@/hooks"
  },
  "iconLibrary": "lucide"
}
```

> `components.json` documents the conventions shadcn/ui's CLI (`bunx shadcn@latest add <component>`) uses when adding components in later tasks — same aliases as this file, so generated components land in `components/ui/` and import `cn` from `@/lib/utils` without edits.

- [ ] **Step 6: Create `packages/web/lib/utils.ts`**

```typescript
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
```

- [ ] **Step 7: Create `packages/web/components/ui/button.tsx`**

```typescript
import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'

import { cn } from '@/lib/utils'

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-all disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive",
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground shadow-xs hover:bg-primary/90',
        destructive:
          'bg-destructive text-white shadow-xs hover:bg-destructive/90 focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40 dark:bg-destructive/60',
        outline:
          'border bg-background shadow-xs hover:bg-accent hover:text-accent-foreground dark:bg-input/30 dark:border-input dark:hover:bg-input/50',
        secondary: 'bg-secondary text-secondary-foreground shadow-xs hover:bg-secondary/80',
        ghost: 'hover:bg-accent hover:text-accent-foreground dark:hover:bg-accent/50',
        link: 'text-primary underline-offset-4 hover:underline'
      },
      size: {
        default: 'h-9 px-4 py-2 has-[>svg]:px-3',
        sm: 'h-8 rounded-md gap-1.5 px-3 has-[>svg]:px-2.5',
        lg: 'h-10 rounded-md px-6 has-[>svg]:px-4',
        icon: 'size-9'
      }
    },
    defaultVariants: {
      variant: 'default',
      size: 'default'
    }
  }
)

function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<'button'> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot : 'button'

  return (
    <Comp
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
```

- [ ] **Step 8: Create `packages/web/global.d.ts`**

```typescript
declare module "*.css";
```

> Next.js's shipped types (`next/image-types/global.d.ts`) only declare `*.module.css` (CSS Modules) — not a plain, non-module `.css` side-effect import like `globals.css`. Without this declaration, `tsc` fails to resolve `import './globals.css'` with "Cannot find module './globals.css' or its corresponding type declarations" (or, under `noUncheckedSideEffectImports`, the side-effect-import variant of that message). `next build`'s own type-checking pass can be more lenient about this than a direct `tsc` invocation, so the gap can go unnoticed until someone runs `tsc` directly or their editor's TypeScript server flags it.

- [ ] **Step 9: Verify**

```bash
cd packages/web && bunx tsc --noEmit && bun run build
```

Expected: no type errors, build succeeds. Then start both servers, temporarily drop `<Button>Test</Button>` into `app/page.tsx`, and confirm it renders with a dark, rounded, padded style (not an unstyled browser default button) — proof Tailwind's utility classes and the CSS variables in `globals.css` are actually being applied. Remove the temporary `<Button>` afterward; it was only to prove the pipeline works.

```bash
bun run --filter api dev &
bun run --filter web dev
```

---

### Task 20: Retrofit Existing Components to Tailwind + shadcn/ui

**Files:**

- Modify: `packages/web/components/nav.tsx`
- Modify: `packages/web/app/layout.tsx`
- Modify: `packages/web/components/product-card.tsx`
- Modify: `packages/web/app/page.tsx`
- Modify: `packages/web/components/product-gallery.tsx`
- Modify: `packages/web/components/add-to-cart-button.tsx`
- Modify: `packages/web/app/products/[id]/page.tsx`

**Interfaces:**

- Consumes: Tailwind utilities and `globals.css` (Task 19), `cn()` from `lib/utils.ts` (Task 19), `Button` from `components/ui/button.tsx` (Task 19)
- Produces: same public component props/behavior as before — this task is presentation-only, no prop or behavior changes

> Pure styling migration: replace every inline `style={{...}}` prop with Tailwind classes, and swap the plain `<button>` in `AddToCartButton` for the shadcn `<Button>`. No aria-labels, no logic, no data-fetching changes. As a side effect this also fixes two known cosmetic gaps: the PLP grid gets real `grid-template-columns` (previously `display: grid` had none, so it rendered as a single column), and the PDP gallery's main image gets a `sizes` prop (previously missing, inconsistent with `ProductCard`).

- [ ] **Step 1: Update `packages/web/components/nav.tsx`**

```typescript
import Link from 'next/link'
import { headers } from 'next/headers'
import { fetchCart } from '@/lib/api'

export async function Nav() {
  let itemCount = 0
  try {
    const cookie = (await headers()).get('cookie')
    const cart = await fetchCart(cookie ? { headers: { Cookie: cookie } } : undefined)
    itemCount = cart.items.reduce((sum, item) => sum + item.quantity, 0)
  } catch {
    // cart fetch fails gracefully — show 0
  }

  return (
    <header className="border-b">
      <nav
        aria-label="Main navigation"
        className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4"
      >
        <Link href="/" aria-label="Marketplace home" className="text-lg font-semibold">
          Marketplace
        </Link>
        <Link
          href="/cart"
          aria-label={`Cart, ${itemCount} item${itemCount !== 1 ? 's' : ''}`}
          className="text-sm font-medium"
        >
          Cart
          {itemCount > 0 && (
            <span aria-hidden="true" className="ml-1 text-muted-foreground">
              {' '}
              ({itemCount})
            </span>
          )}
        </Link>
      </nav>
    </header>
  )
}
```

- [ ] **Step 2: Update `packages/web/app/layout.tsx`**

```typescript
import './globals.css'
import type { Metadata } from 'next'
import { Nav } from '@/components/nav'

export const metadata: Metadata = {
  title: { default: 'Marketplace', template: '%s | Marketplace' },
  description: 'Quality clothing and accessories.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Nav />
        <main id="main-content" className="mx-auto max-w-6xl px-4 py-8">
          {children}
        </main>
      </body>
    </html>
  )
}
```

- [ ] **Step 3: Update `packages/web/components/product-card.tsx`**

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
          className="aspect-square w-full rounded-md object-cover"
        />
        <h2 className="mt-3 text-sm font-medium">{name}</h2>
        <p
          aria-label={`Price: ${currency} ${unit_price.toFixed(2)}`}
          className="mt-1 text-sm text-muted-foreground"
        >
          {currency === 'GBP' ? '£' : currency}
          {unit_price.toFixed(2)}
        </p>
      </Link>
    </article>
  )
}
```

- [ ] **Step 4: Update `packages/web/app/page.tsx`**

```typescript
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
        className="mt-6 grid list-none grid-cols-2 gap-6 p-0 sm:grid-cols-3"
      >
        {results.map((product) => (
          <li key={product.id}>
            <ProductCard {...product} />
          </li>
        ))}
      </ul>
    </>
  );
}
```

- [ ] **Step 5: Update `packages/web/components/product-gallery.tsx`**

```typescript
'use client'

import Image from 'next/image'
import { useState } from 'react'
import { cn } from '@/lib/utils'

interface Props {
  images: string[]
  productName: string
}

export function ProductGallery({ images, productName }: Props) {
  const [selected, setSelected] = useState(0)

  if (images.length === 0) return null

  return (
    <div>
      <Image
        src={images[selected]}
        alt={productName}
        width={800}
        height={800}
        priority
        sizes="(max-width: 1024px) 100vw, 50vw"
        className="aspect-square w-full rounded-md object-cover"
      />
      {images.length > 1 && (
        <div role="list" aria-label="Product images" className="mt-3 flex gap-2">
          {images.map((src, i) => (
            <button
              key={src}
              role="listitem"
              onClick={() => setSelected(i)}
              aria-label={`View image ${i + 1}`}
              aria-pressed={selected === i}
              className={cn(
                'overflow-hidden rounded-md border-2',
                selected === i ? 'border-primary' : 'border-transparent'
              )}
            >
              <Image
                src={src}
                alt={`${productName} view ${i + 1}`}
                width={80}
                height={80}
                className="aspect-square object-cover"
              />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 6: Update `packages/web/components/add-to-cart-button.tsx`**

```typescript
'use client'

import { useState } from 'react'
import { addToCart } from '@/lib/api'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'

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
    <div className="mt-4">
      <Button onClick={handleClick} disabled={loading} aria-busy={loading}>
        {loading ? 'Adding...' : 'Add to Cart'}
      </Button>
      {error && <p role="alert" className="mt-2 text-sm text-destructive">{error}</p>}
    </div>
  )
}
```

- [ ] **Step 7: Update `packages/web/app/products/[id]/page.tsx`**

```typescript
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { ApiRequestError, fetchProduct } from '@/lib/api'
import { ProductGallery } from '@/components/product-gallery'
import { AddToCartButton } from '@/components/add-to-cart-button'

interface Props {
  params: Promise<{ id: string }>
}

async function fetchProductOrNotFound(id: number) {
  try {
    return await fetchProduct(id)
  } catch (err) {
    if (err instanceof ApiRequestError && err.status === 404) return null
    throw err
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params
  const product = await fetchProductOrNotFound(parseInt(id, 10))
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
  const product = await fetchProductOrNotFound(parseInt(id, 10))

  if (!product) notFound()

  return (
    <article aria-label={product.name} className="grid gap-8 sm:grid-cols-2">
      <ProductGallery images={product.image_urls} productName={product.name} />
      <div>
        <h1 className="text-2xl font-semibold">{product.name}</h1>
        <p className="mt-2 text-muted-foreground">{product.description}</p>
        <p
          aria-label={`Price: ${product.currency} ${product.unit_price.toFixed(2)}`}
          className="mt-4 text-lg font-medium"
        >
          {product.currency === 'GBP' ? '£' : product.currency}
          {product.unit_price.toFixed(2)}
        </p>
        <AddToCartButton productId={product.id} />
      </div>
    </article>
  )
}
```

- [ ] **Step 8: Verify in browser**

```bash
bun run --filter api dev &
bun run --filter web dev
```

Visit `http://localhost:3000`, a product page, and `http://localhost:3000/products/1`. Expected: identical functionality to before (nav badge, product grid — now genuinely multi-column, gallery thumbnail switching, add-to-cart), but styled instead of unstyled HTML. No aria-label or behavior regressions.

```bash
cd packages/web && bunx tsc --noEmit
```

Expected: no errors.
