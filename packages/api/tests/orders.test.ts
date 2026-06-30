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
