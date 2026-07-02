> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Phase 8 — Checkout & Confirmation** | [link to overview](../2026-06-30-marketplace.md)

**Global Constraints:** See [overview](../2026-06-30-marketplace.md#global-constraints) — all constraints apply here.

---

## Phase 8 — Checkout & Confirmation

### Task 22: Checkout Page

**Files:**

- Create: `packages/web/components/address-form.tsx`
- Create: `packages/web/components/stripe-payment-form.tsx`
- Create: `packages/web/app/checkout/page.tsx`

**Interfaces:**

- Consumes: `fetchCart()`, `createPaymentIntent(cartId)`, `placeOrder(body)`
- Produces: client-side checkout page at `/checkout` with UK address form and Stripe CardElement
- On success: redirects to `/order-confirmation/:id`

> `stripe.confirmCardPayment` is used (not `stripe.confirmPayment`) to avoid redirects. `allow_redirects: 'never'` was set on the PaymentIntent in Task 12.

- [ ] **Step 1: Create `packages/web/components/address-form.tsx`**

```typescript
import type { UseFormRegister, FieldErrors } from 'react-hook-form'
import type { AddressInput } from '@marketplace/core'

interface Props {
  register: UseFormRegister<AddressInput>
  errors: FieldErrors<AddressInput>
}

export function AddressForm({ register, errors }: Props) {
  return (
    <fieldset>
      <legend>Delivery Address</legend>

      <div>
        <label htmlFor="name">Full name</label>
        <input
          id="name"
          type="text"
          autoComplete="name"
          aria-describedby={errors.name ? 'name-error' : undefined}
          aria-invalid={!!errors.name}
          {...register('name')}
        />
        {errors.name && <p id="name-error" role="alert">{errors.name.message}</p>}
      </div>

      <div>
        <label htmlFor="street">Street address</label>
        <input
          id="street"
          type="text"
          autoComplete="address-line1"
          aria-describedby={errors.street ? 'street-error' : undefined}
          aria-invalid={!!errors.street}
          {...register('street')}
        />
        {errors.street && <p id="street-error" role="alert">{errors.street.message}</p>}
      </div>

      <div>
        <label htmlFor="city">City</label>
        <input
          id="city"
          type="text"
          autoComplete="address-level2"
          aria-invalid={!!errors.city}
          {...register('city')}
        />
        {errors.city && <p role="alert">{errors.city.message}</p>}
      </div>

      <div>
        <label htmlFor="postcode">Postcode</label>
        <input
          id="postcode"
          type="text"
          autoComplete="postal-code"
          aria-invalid={!!errors.postcode}
          {...register('postcode')}
        />
        {errors.postcode && <p role="alert">{errors.postcode.message}</p>}
      </div>
    </fieldset>
  )
}
```

- [ ] **Step 2: Create `packages/web/components/stripe-payment-form.tsx`**

```typescript
'use client'

import { CardElement } from '@stripe/react-stripe-js'

export function StripePaymentForm() {
  return (
    <fieldset>
      <legend>Payment Details</legend>
      <div>
        <label htmlFor="card-element">Card details</label>
        <div id="card-element" role="group" aria-label="Credit or debit card">
          <CardElement
            options={{
              style: { base: { fontSize: '16px' } },
              hidePostalCode: true,
            }}
          />
        </div>
        <p>Test card: 4242 4242 4242 4242 · Any future date · Any CVC</p>
      </div>
    </fieldset>
  )
}
```

- [ ] **Step 3: Create `packages/web/app/checkout/page.tsx`**

```typescript
'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { AddressSchema, type AddressInput } from '@marketplace/core'
import { Elements, useStripe, useElements, CardElement } from '@stripe/react-stripe-js'
import { stripePromise } from '@/lib/stripe'
import { fetchCart, createPaymentIntent, placeOrder } from '@/lib/api'
import { AddressForm } from '@/components/address-form'
import { StripePaymentForm } from '@/components/stripe-payment-form'
import type { Cart } from '@marketplace/core'

export type CheckoutFormValues = AddressInput

function CheckoutForm({ cart }: { cart: Cart }) {
  const stripe = useStripe()
  const elements = useElements()
  const router = useRouter()
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const { register, handleSubmit, formState: { errors } } = useForm<CheckoutFormValues>({
    resolver: zodResolver(AddressSchema),
  })

  async function onSubmit(values: CheckoutFormValues) {
    if (!stripe || !elements || !cart.id) return
    setSubmitting(true)
    setFormError(null)

    try {
      const { clientSecret } = await createPaymentIntent(cart.id)

      const cardElement = elements.getElement(CardElement)
      if (!cardElement) throw new Error('Card element not mounted')

      const { error, paymentIntent } = await stripe.confirmCardPayment(clientSecret, {
        payment_method: {
          card: cardElement,
          billing_details: { name: values.name, address: { country: 'GB' } },
        },
      })

      if (error || !paymentIntent) {
        setFormError(error?.message ?? 'Payment failed. Please try again.')
        return
      }

      const order = await placeOrder({
        cartId: cart.id,
        paymentIntentId: paymentIntent.id,
        address_details: values,
      })

      router.push(`/order-confirmation/${order.id}`)
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} aria-label="Checkout form" noValidate>
      <h1>Checkout</h1>

      <AddressForm register={register} errors={errors} />
      <StripePaymentForm />

      <div>
        <p aria-label={`Order total: £${cart.total_price.toFixed(2)}`}>
          Total: £{cart.total_price.toFixed(2)}
        </p>
        <button type="submit" disabled={submitting || !stripe} aria-busy={submitting}>
          {submitting ? 'Processing...' : 'Place Order'}
        </button>
      </div>

      {formError && <p role="alert">{formError}</p>}
    </form>
  )
}

export default function CheckoutPage() {
  const [cart, setCart] = useState<Cart | null>(null)
  const router = useRouter()

  useEffect(() => {
    fetchCart().then((c) => {
      if (!c.id || c.items.length === 0) {
        router.push('/cart')
        return
      }
      setCart(c)
    })
  }, [router])

  if (!cart) return <p aria-busy="true">Loading...</p>

  return (
    <Elements stripe={stripePromise}>
      <CheckoutForm cart={cart} />
    </Elements>
  )
}
```

- [ ] **Step 4: Verify in browser**

Add product to cart, go to `/cart`, click "Proceed to Checkout". Expected: form with address fields and Stripe card input. Fill with test card `4242 4242 4242 4242`, any future date, any CVC, any postcode in format `SW1A 2AA`. Submit. Expected: redirect to `/order-confirmation/:id`.

---

### Task 23: Order Confirmation Page

**Files:**

- Create: `packages/web/app/order-confirmation/[id]/page.tsx`

**Interfaces:**

- Consumes: Order ID from URL params; order details are passed via `router.push` state — but since Next.js server components can't read router state, fetch the order from the API.
- Note: A `GET /order/:id` endpoint is needed. Add it to the orders router in the API.

- [ ] **Step 1: Add `GET /order/:id` to the API**

Add to `packages/api/src/routes/orders.ts`:

```typescript
router.get("/:id", async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      res.status(404).json({ error: "Order not found", code: "NOT_FOUND" });
      return;
    }

    const order = await prisma.order.findUnique({
      where: { id },
      include: { items: { include: { product: true } } },
    });

    if (!order) {
      res.status(404).json({ error: "Order not found", code: "NOT_FOUND" });
      return;
    }

    res.json({
      id: order.id,
      total_price: Number(order.total_price),
      currency: order.currency,
      status: order.status,
      items: order.items.map((item) => ({
        quantity: item.quantity,
        price: Number(item.price),
        currency: "GBP",
        product: {
          id: item.product.id,
          name: item.product.name,
          primary_image: item.product.primary_image,
        },
      })),
      address_details: {
        name: order.address_name,
        street: order.address_street,
        city: order.address_city,
        postcode: order.address_postcode,
      },
      payment_details: { card_last_four_digits: order.card_last_four },
    });
  } catch (err) {
    next(err);
  }
});
```

Also add `fetchOrder` to `packages/web/lib/api.ts`:

```typescript
export function fetchOrder(id: number) {
  return apiFetch<Order>(`/order/${id}`);
}
```

- [ ] **Step 2: Create `packages/web/app/order-confirmation/[id]/page.tsx`**

```typescript
import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { fetchOrder } from '@/lib/api'

interface Props {
  params: Promise<{ id: string }>
}

export const metadata: Metadata = { title: 'Order Confirmed' }

export default async function OrderConfirmationPage({ params }: Props) {
  const { id } = await params
  const order = await fetchOrder(parseInt(id, 10)).catch(() => null)

  if (!order) notFound()

  return (
    <article aria-label="Order confirmation">
      <h1>Order Confirmed</h1>
      <p>Thank you for your order. Your order number is <strong>#{order.id}</strong>.</p>

      <section aria-label="Order summary">
        <h2>Order Summary</h2>
        <ul>
          {order.items.map((item) => (
            <li key={item.product.id}>
              {item.product.name} × {item.quantity} —{' '}
              £{item.price.toFixed(2)}
            </li>
          ))}
        </ul>
        <p aria-label={`Total: £${order.total_price.toFixed(2)}`}>
          <strong>Total: £{order.total_price.toFixed(2)}</strong>
        </p>
      </section>

      <section aria-label="Delivery details">
        <h2>Delivering to</h2>
        <address>
          {order.address_details.name}<br />
          {order.address_details.street}<br />
          {order.address_details.city}<br />
          {order.address_details.postcode}
        </address>
      </section>

      <section aria-label="Payment details">
        <h2>Payment</h2>
        <p>Card ending in {order.payment_details.card_last_four_digits}</p>
      </section>

      <Link href="/">Continue Shopping</Link>
    </article>
  )
}
```

- [ ] **Step 3: Verify in browser**

Complete a checkout. Expected: redirect to `/order-confirmation/:id` with order ID, item list, address, and last 4 card digits shown.
