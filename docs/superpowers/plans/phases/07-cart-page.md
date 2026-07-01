> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Phase 7 — Cart Page** | [link to overview](../2026-06-30-marketplace.md)

**Global Constraints:** See [overview](../2026-06-30-marketplace.md#global-constraints) — all constraints apply here.

---

## Phase 7 — Cart Page

### Task 19: Cart Page

**Files:**

- Create: `packages/web/components/cart-item-row.tsx`
- Create: `packages/web/app/cart/page.tsx`

**Interfaces:**

- Consumes: `fetchCart()`, `updateCartItem(productId, quantity)`, `removeFromCart(productId)`
- Produces: SSR cart page at `/cart` showing items with quantity controls and order total

- [ ] **Step 1: Create `packages/web/components/cart-item-row.tsx`**

```typescript
'use client'

import Image from 'next/image'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { updateCartItem, removeFromCart } from '@/lib/api'
import type { CartItem } from '@marketplace/core'

interface Props {
  item: CartItem
}

export function CartItemRow({ item }: Props) {
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function handleQuantityChange(newQty: number) {
    setLoading(true)
    try {
      await updateCartItem(item.product.id, newQty)
      router.refresh()
    } finally {
      setLoading(false)
    }
  }

  async function handleRemove() {
    setLoading(true)
    try {
      await removeFromCart(item.product.id)
      router.refresh()
    } finally {
      setLoading(false)
    }
  }

  return (
    <li aria-label={item.product.name}>
      <Image
        src={item.product.primary_image}
        alt={item.product.name}
        width={80}
        height={80}
        style={{ objectFit: 'cover' }}
      />
      <div>
        <p>{item.product.name}</p>
        <p aria-label={`Item total: £${item.price.toFixed(2)}`}>£{item.price.toFixed(2)}</p>
        <div>
          <button
            onClick={() => handleQuantityChange(item.quantity - 1)}
            disabled={loading || item.quantity <= 1}
            aria-label="Decrease quantity"
          >
            −
          </button>
          <span aria-label={`Quantity: ${item.quantity}`}>{item.quantity}</span>
          <button
            onClick={() => handleQuantityChange(item.quantity + 1)}
            disabled={loading}
            aria-label="Increase quantity"
          >
            +
          </button>
        </div>
        <button onClick={handleRemove} disabled={loading} aria-label={`Remove ${item.product.name}`}>
          Remove
        </button>
      </div>
    </li>
  )
}
```

- [ ] **Step 2: Create `packages/web/app/cart/page.tsx`**

```typescript
import type { Metadata } from 'next'
import Link from 'next/link'
import { fetchCart } from '@/lib/api'
import { CartItemRow } from '@/components/cart-item-row'

export const metadata: Metadata = { title: 'Your Cart' }

export default async function CartPage() {
  const cart = await fetchCart()

  if (cart.items.length === 0) {
    return (
      <>
        <h1>Your Cart</h1>
        <p>Your cart is empty.</p>
        <Link href="/">Continue Shopping</Link>
      </>
    )
  }

  return (
    <>
      <h1>Your Cart</h1>
      <ul aria-label="Cart items">
        {cart.items.map((item) => (
          <CartItemRow key={item.product.id} item={item} />
        ))}
      </ul>
      <div>
        <p aria-label={`Order total: £${cart.total_price.toFixed(2)}`}>
          Total: £{cart.total_price.toFixed(2)}
        </p>
        <Link href="/checkout">
          Proceed to Checkout
        </Link>
      </div>
    </>
  )
}
```

- [ ] **Step 3: Verify in browser**

Add a product to cart via a PDP page. Visit `http://localhost:3000/cart`. Expected: item listed with quantity controls, total, and "Proceed to Checkout" link.
