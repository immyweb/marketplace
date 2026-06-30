import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { agent } from 'supertest';
import Stripe from 'stripe';
import { app } from '../src/app.js';
import { prisma } from '../src/db/prisma.js';

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
