> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Phase 5 — Frontend Foundation** | [link to overview](../2026-06-30-marketplace.md)

**Global Constraints:** See [overview](../2026-06-30-marketplace.md#global-constraints) — all constraints apply here.

---

## Phase 5 — Frontend Foundation

### Task 15: API Client + Stripe Loader

**Files:**

- Create: `packages/web/lib/api.ts`
- Create: `packages/web/lib/stripe.ts`

**Interfaces:**

- Produces: `fetchProducts()`, `fetchProduct(id)`, `fetchCart()`, `addToCart(productId, quantity)`, `updateCartItem(productId, quantity)`, `removeFromCart(productId)`, `createPaymentIntent(cartId)`, `placeOrder(body)` — all typed, all throw on error with `ApiError`
- Consumes: `Cart`, `Order`, `Product` types from `@marketplace/core` (defined in Task 3)

> Types live in `@marketplace/core`. This task only creates the fetch wrappers and Stripe loader — no type duplication.

- [ ] **Step 1: Create `packages/web/lib/api.ts`**

```typescript
import type { Cart, Order, Product } from "@marketplace/core";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    credentials: "include",
    headers: { "Content-Type": "application/json", ...init?.headers },
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: "Request failed" }));
    throw Object.assign(new Error(body.error ?? "Request failed"), {
      code: body.code,
      status: res.status,
    });
  }

  return res.json() as Promise<T>;
}

export function fetchProducts() {
  return apiFetch<{ results: Omit<Product, "description" | "image_urls">[] }>(
    "/products",
  );
}

export function fetchProduct(id: number) {
  return apiFetch<Product>(`/products/${id}`);
}

export function fetchCart() {
  return apiFetch<Cart>("/cart");
}

export function addToCart(productId: number, quantity: number) {
  return apiFetch<Cart>("/cart/products", {
    method: "POST",
    body: JSON.stringify({ productId, quantity }),
  });
}

export function updateCartItem(productId: number, quantity: number) {
  return apiFetch<Cart>(`/cart/products/${productId}`, {
    method: "PUT",
    body: JSON.stringify({ quantity }),
  });
}

export function removeFromCart(productId: number) {
  return apiFetch<Cart>(`/cart/products/${productId}`, { method: "DELETE" });
}

export function createPaymentIntent(cartId: number) {
  return apiFetch<{ clientSecret: string; amount: number }>(
    "/checkout/payment-intent",
    {
      method: "POST",
      body: JSON.stringify({ cartId }),
    },
  );
}

export function placeOrder(body: {
  cartId: number;
  paymentIntentId: string;
  address_details: {
    name: string;
    street: string;
    city: string;
    postcode: string;
  };
}) {
  return apiFetch<Order>("/order", {
    method: "POST",
    body: JSON.stringify(body),
  });
}
```

- [ ] **Step 3: Create `packages/web/lib/stripe.ts`**

```typescript
import { loadStripe } from "@stripe/stripe-js";

export const stripePromise = loadStripe(
  process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!,
);
```

- [ ] **Step 3: Type-check**

```bash
cd packages/web && npx tsc --noEmit
```

Expected: no errors

---

### Task 16: Root Layout + Navigation

**Files:**

- Create: `packages/web/components/nav.tsx`
- Modify: `packages/web/app/layout.tsx`

**Interfaces:**

- Produces: `<Nav>` — server component that fetches cart and displays item count badge
- Consumes: `fetchCart()` from `packages/web/lib/api.ts`

- [ ] **Step 1: Create `packages/web/components/nav.tsx`**

```typescript
import Link from 'next/link'
import { fetchCart } from '@/lib/api'

export async function Nav() {
  let itemCount = 0
  try {
    const cart = await fetchCart()
    itemCount = cart.items.reduce((sum, item) => sum + item.quantity, 0)
  } catch {
    // cart fetch fails gracefully — show 0
  }

  return (
    <header>
      <nav aria-label="Main navigation">
        <Link href="/" aria-label="Marketplace home">
          Marketplace
        </Link>
        <Link href="/cart" aria-label={`Cart, ${itemCount} item${itemCount !== 1 ? 's' : ''}`}>
          Cart
          {itemCount > 0 && (
            <span aria-hidden="true"> ({itemCount})</span>
          )}
        </Link>
      </nav>
    </header>
  )
}
```

- [ ] **Step 2: Update `packages/web/app/layout.tsx`**

```typescript
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

- [ ] **Step 3: Verify**

Start both servers and visit `http://localhost:3000`. Expected: page renders with "Marketplace" and "Cart" navigation links.

```bash
bun run --filter api dev &
bun run --filter web dev
```
