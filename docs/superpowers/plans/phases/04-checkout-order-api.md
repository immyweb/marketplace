> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Phase 4 — Checkout & Order API** | [link to overview](../2026-06-30-marketplace.md)

**Global Constraints:** See [overview](../2026-06-30-marketplace.md#global-constraints) — all constraints apply here.

---

## Phase 4 — Checkout & Order API

### Task 13: POST /checkout/payment-intent

**Files:**

- Create: `packages/api/src/routes/checkout.ts`
- Create: `packages/api/tests/orders.test.ts` (partial — setup for Tasks 12 & 13)

**Interfaces:**

- Produces: `POST /checkout/payment-intent` with body `{ cartId: number }` → `{ clientSecret: string; amount: number }`
- Consumes: Stripe `sk_test_` key from `process.env.STRIPE_SECRET_KEY`

> This endpoint creates a Stripe PaymentIntent for the cart's total. The client uses the `clientSecret` to confirm payment via Stripe CardElement. Amount is in pence (GBP × 100).

- [ ] **Step 1: Write the failing test**

Create `packages/api/tests/orders.test.ts`:

```typescript
import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { agent } from 'supertest';
import { app } from '../src/app.js';
import { prisma } from '../src/db/prisma.js';

let productId: number;

beforeEach(async () => {
  await prisma.orderItem.deleteMany();
  await prisma.order.deleteMany();
  await prisma.cartItem.deleteMany();
  await prisma.cart.deleteMany();
  await prisma.product.deleteMany();

  const product = await prisma.product.create({
    data: {
      name: 'Test Product',
      description: 'desc',
      primary_image: 'img.jpg',
      image_urls: [],
      unit_price: 15.0,
      currency: 'GBP'
    }
  });
  productId = product.id;
});

afterAll(async () => {
  await prisma.orderItem.deleteMany();
  await prisma.order.deleteMany();
  await prisma.cartItem.deleteMany();
  await prisma.cart.deleteMany();
  await prisma.product.deleteMany();
});

describe('POST /checkout/payment-intent', () => {
  it('creates a Stripe PaymentIntent and returns clientSecret', async () => {
    const ag = agent(app);
    await ag.post('/cart/products').send({ productId, quantity: 2 });
    const cartRes = await ag.get('/cart');
    const cartId = cartRes.body.id;

    const res = await ag
      .post('/checkout/payment-intent')
      .send({ cartId })
      .expect(200);

    expect(res.body.clientSecret).toMatch(/^pi_.*_secret_.*/);
    expect(res.body.amount).toBe(30); // 15.00 × 2
  });

  it('returns 404 when cart is empty or does not exist', async () => {
    await agent(app)
      .post('/checkout/payment-intent')
      .send({ cartId: 999999 })
      .expect(404);
  });
});
```

- [ ] **Step 2: Run to confirm failure**

```bash
bun run --filter api test -- --reporter=verbose
```

Expected: FAIL

- [ ] **Step 3: Create `packages/api/src/routes/checkout.ts`**

```typescript
import { Router } from 'express';
import Stripe from 'stripe';
import { prisma } from '../db/prisma.js';

const router = Router();

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

router.post('/payment-intent', async (req, res, next) => {
  try {
    const { cartId } = req.body as { cartId?: unknown };

    if (typeof cartId !== 'number') {
      res
        .status(400)
        .json({ error: 'cartId is required', code: 'INVALID_INPUT' });
      return;
    }

    const cart = await prisma.cart.findUnique({
      where: { id: cartId },
      include: { items: { include: { product: true } } }
    });

    if (!cart || cart.items.length === 0) {
      res
        .status(404)
        .json({ error: 'Cart not found or empty', code: 'NOT_FOUND' });
      return;
    }

    const totalPence = Math.round(
      cart.items.reduce(
        (sum, item) => sum + Number(item.product.unit_price) * item.quantity,
        0
      ) * 100
    );

    const paymentIntent = await stripe.paymentIntents.create({
      amount: totalPence,
      currency: 'gbp',
      automatic_payment_methods: { enabled: true, allow_redirects: 'never' },
      metadata: { cartId: String(cartId) }
    });

    res.json({
      clientSecret: paymentIntent.client_secret,
      amount: totalPence / 100
    });
  } catch (err) {
    next(err);
  }
});

export default router;
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
bun run --filter api test -- --reporter=verbose
```

Expected: PASS ✓ (this makes a real Stripe test API call — ensure `STRIPE_SECRET_KEY` is set in `.env.test`)

- [ ] **Step 5: Commit**

```bash
git add packages/api/src/routes/checkout.ts api/tests/orders.test.ts
git commit -m "feat: add POST /checkout/payment-intent — create Stripe PaymentIntent"
```

---

### Task 14: POST /order

**Files:**

- Create: `packages/api/src/routes/orders.ts`
- Modify: `packages/api/tests/orders.test.ts`

**Interfaces:**

- Produces: `POST /order` with body `{ cartId, paymentIntentId, address_details }` → `Order`
- Verifies PaymentIntent status with Stripe before creating the order
- Clears `req.session.cartId` after success

```typescript
// Request body
interface PlaceOrderBody {
  cartId: number;
  paymentIntentId: string;
  address_details: {
    name: string;
    street: string;
    city: string;
    postcode: string;
  };
}

// Response
interface OrderResponse {
  id: number;
  total_price: number;
  currency: string;
  status: string;
  items: Array<{
    quantity: number;
    price: number;
    currency: string;
    product: { id: number; name: string; primary_image: string };
  }>;
  address_details: {
    name: string;
    street: string;
    city: string;
    postcode: string;
  };
  payment_details: { card_last_four_digits: string };
}
```

- [ ] **Step 1: Write the failing test**

Add to `packages/api/tests/orders.test.ts`:

```typescript
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

async function createConfirmedPaymentIntent(amountGbp: number) {
  const pi = await stripe.paymentIntents.create({
    amount: Math.round(amountGbp * 100),
    currency: 'gbp',
    automatic_payment_methods: { enabled: true, allow_redirects: 'never' },
    payment_method: 'pm_card_visa',
    confirm: true
  });
  return pi;
}

describe('POST /order', () => {
  it('creates an order from a confirmed payment intent', async () => {
    const ag = agent(app);
    await ag.post('/cart/products').send({ productId, quantity: 2 });
    const cartRes = await ag.get('/cart');
    const cartId = cartRes.body.id;

    const pi = await createConfirmedPaymentIntent(30);

    const res = await ag
      .post('/order')
      .send({
        cartId,
        paymentIntentId: pi.id,
        address_details: {
          name: 'Jane Smith',
          street: '10 Downing Street',
          city: 'London',
          postcode: 'SW1A 2AA'
        }
      })
      .expect(201);

    expect(res.body).toMatchObject({
      total_price: 30,
      currency: 'GBP',
      status: 'confirmed',
      address_details: { name: 'Jane Smith', city: 'London' }
    });
    expect(res.body.payment_details.card_last_four_digits).toHaveLength(4);
    expect(res.body.items).toHaveLength(1);

    // Cart should be cleared after order
    const cartAfter = await ag.get('/cart');
    expect(cartAfter.body.items).toHaveLength(0);
  });

  it('returns 400 when paymentIntentId does not exist or is not succeeded', async () => {
    const ag = agent(app);
    await ag.post('/cart/products').send({ productId, quantity: 1 });
    const cartRes = await ag.get('/cart');

    const res = await ag
      .post('/order')
      .send({
        cartId: cartRes.body.id,
        paymentIntentId: 'pi_fake_id',
        address_details: {
          name: 'Jane',
          street: '1 St',
          city: 'London',
          postcode: 'SW1A 1AA'
        }
      })
      .expect(400);

    expect(res.body).toMatchObject({ error: expect.any(String) });
  });
});
```

- [ ] **Step 2: Run to confirm failure**

```bash
bun run --filter api test -- --reporter=verbose
```

Expected: FAIL

- [ ] **Step 3: Create `packages/api/src/routes/orders.ts`**

```typescript
import { Router } from 'express';
import Stripe from 'stripe';
import { PlaceOrderSchema } from '@marketplace/core';
import { prisma } from '../db/prisma.js';

const router = Router();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

router.post('/', async (req, res, next) => {
  try {
    const parsed = PlaceOrderSchema.safeParse(req.body);
    if (!parsed.success) {
      res
        .status(400)
        .json({ error: parsed.error.errors[0].message, code: 'INVALID_INPUT' });
      return;
    }
    const { cartId, paymentIntentId, address_details } = parsed.data;

    let paymentIntent: Stripe.PaymentIntent;
    try {
      paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId, {
        expand: ['payment_method']
      });
    } catch {
      res
        .status(400)
        .json({ error: 'Invalid payment intent', code: 'PAYMENT_FAILED' });
      return;
    }

    if (paymentIntent.status !== 'succeeded') {
      res
        .status(400)
        .json({ error: 'Payment not completed', code: 'PAYMENT_FAILED' });
      return;
    }

    const cart = await prisma.cart.findUnique({
      where: { id: cartId },
      include: { items: { include: { product: true } } }
    });

    if (!cart || cart.items.length === 0) {
      res
        .status(404)
        .json({ error: 'Cart not found or empty', code: 'NOT_FOUND' });
      return;
    }

    const orderItems = cart.items.map((item) => ({
      product_id: item.product_id,
      quantity: item.quantity,
      price: Number(item.product.unit_price) * item.quantity
    }));

    const totalPrice = orderItems.reduce((sum, item) => sum + item.price, 0);

    const pm = paymentIntent.payment_method;
    const cardLastFour =
      pm && typeof pm === 'object' && pm.type === 'card' && pm.card?.last4
        ? pm.card.last4
        : '0000';

    const order = await prisma.order.create({
      data: {
        total_price: totalPrice,
        stripe_payment_id: paymentIntentId,
        card_last_four: cardLastFour,
        address_name: address_details.name,
        address_street: address_details.street,
        address_city: address_details.city,
        address_postcode: address_details.postcode,
        items: {
          create: orderItems
        }
      },
      include: { items: { include: { product: true } } }
    });

    await prisma.cart.delete({ where: { id: cartId } });
    req.session.cartId = undefined;

    const response = {
      id: order.id,
      total_price: Number(order.total_price),
      currency: order.currency,
      status: order.status,
      items: order.items.map((item) => ({
        quantity: item.quantity,
        price: Number(item.price),
        currency: 'GBP',
        product: {
          id: item.product.id,
          name: item.product.name,
          primary_image: item.product.primary_image
        }
      })),
      address_details: {
        name: order.address_name,
        street: order.address_street,
        city: order.address_city,
        postcode: order.address_postcode
      },
      payment_details: {
        card_last_four_digits: order.card_last_four
      }
    };

    res.status(201).json(response);
  } catch (err) {
    next(err);
  }
});

export default router;
```

- [ ] **Step 4: Run all API tests to confirm they pass**

```bash
bun run --filter api test -- --reporter=verbose
```

Expected: PASS — all product, cart, and order tests ✓

- [ ] **Step 5: Commit**

```bash
git add packages/api/src/routes/orders.ts api/tests/orders.test.ts
git commit -m "feat: add POST /order — place order via Stripe PaymentIntent"
```
