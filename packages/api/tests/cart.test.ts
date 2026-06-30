import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { agent } from 'supertest';
import { app } from '../src/app.js';
import { prisma } from '../src/db/prisma.js';

let productId: number;

beforeEach(async () => {
  await prisma.cartItem.deleteMany();
  await prisma.cart.deleteMany();
  await prisma.product.deleteMany();

  const product = await prisma.product.create({
    data: {
      name: 'Test T-Shirt',
      description: 'desc',
      primary_image: 'img.jpg',
      image_urls: [],
      unit_price: 10.0,
      currency: 'GBP'
    }
  });
  productId = product.id;
});

afterAll(async () => {
  await prisma.cartItem.deleteMany();
  await prisma.cart.deleteMany();
  await prisma.product.deleteMany();
});

describe('GET /cart', () => {
  it('returns an empty cart when no cart exists for the session', async () => {
    const res = await agent(app).get('/cart').expect(200);
    expect(res.body).toEqual({
      id: null,
      items: [],
      total_price: 0,
      currency: 'GBP'
    });
  });
});

describe('POST /cart/products', () => {
  it('creates a cart and adds the product', async () => {
    const ag = agent(app);
    const res = await ag
      .post('/cart/products')
      .send({ productId, quantity: 2 })
      .expect(200);

    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0]).toMatchObject({
      quantity: 2,
      price: 20,
      currency: 'GBP',
      product: { id: productId, name: 'Test T-Shirt' }
    });
    expect(res.body.total_price).toBe(20);
  });

  it('increments quantity when the same product is added again', async () => {
    const ag = agent(app);
    await ag.post('/cart/products').send({ productId, quantity: 1 });
    const res = await ag
      .post('/cart/products')
      .send({ productId, quantity: 2 })
      .expect(200);

    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0].quantity).toBe(3);
  });

  it('returns 400 when productId is missing', async () => {
    const res = await agent(app)
      .post('/cart/products')
      .send({ quantity: 1 })
      .expect(400);
    expect(res.body).toMatchObject({ error: expect.any(String) });
  });

  it('returns 404 when product does not exist', async () => {
    const res = await agent(app)
      .post('/cart/products')
      .send({ productId: 999999, quantity: 1 })
      .expect(404);
    expect(res.body).toMatchObject({ error: expect.any(String) });
  });
});

describe('PUT /cart/products/:productId', () => {
  it('updates the quantity of an item', async () => {
    const ag = agent(app);
    await ag.post('/cart/products').send({ productId, quantity: 1 });
    const res = await ag
      .put(`/cart/products/${productId}`)
      .send({ quantity: 5 })
      .expect(200);

    expect(res.body.items[0].quantity).toBe(5);
    expect(res.body.total_price).toBe(50);
  });

  it('removes the item when quantity is set to 0', async () => {
    const ag = agent(app);
    await ag.post('/cart/products').send({ productId, quantity: 2 });
    const res = await ag
      .put(`/cart/products/${productId}`)
      .send({ quantity: 0 })
      .expect(200);

    expect(res.body.items).toHaveLength(0);
    expect(res.body.total_price).toBe(0);
  });

  it('returns 404 when no cart exists', async () => {
    await agent(app)
      .put(`/cart/products/${productId}`)
      .send({ quantity: 1 })
      .expect(404);
  });
});
