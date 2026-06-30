import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';
import { prisma } from '../src/db/prisma.js';

let productId: number;

beforeAll(async () => {
  await prisma.orderItem.deleteMany();
  await prisma.order.deleteMany();
  await prisma.cartItem.deleteMany();
  await prisma.cart.deleteMany();
  await prisma.product.deleteMany();

  const product = await prisma.product.create({
    data: {
      name: 'Test T-Shirt',
      description: 'A test product',
      primary_image: 'https://example.com/img.jpg',
      image_urls: ['https://example.com/img.jpg'],
      unit_price: 12.99,
      currency: 'GBP'
    }
  });
  productId = product.id;
});

afterAll(async () => {
  await prisma.product.deleteMany();
});

describe('GET /products', () => {
  it('returns a results array with all products', async () => {
    const res = await request(app).get('/products').expect(200);
    expect(res.body.results).toHaveLength(1);
    expect(res.body.results[0]).toMatchObject({
      id: productId,
      name: 'Test T-Shirt',
      unit_price: 12.99,
      currency: 'GBP'
    });
  });

  it('does not include description or image_urls in listing', async () => {
    const res = await request(app).get('/products').expect(200);
    expect(res.body.results[0]).not.toHaveProperty('description');
    expect(res.body.results[0]).not.toHaveProperty('image_urls');
  });
});

describe('GET /products/:id', () => {
  it('returns full product details', async () => {
    const res = await request(app).get(`/products/${productId}`).expect(200);
    expect(res.body).toMatchObject({
      id: productId,
      name: 'Test T-Shirt',
      description: 'A test product',
      primary_image: 'https://example.com/img.jpg',
      image_urls: ['https://example.com/img.jpg'],
      unit_price: 12.99,
      currency: 'GBP'
    });
  });

  it('returns 404 for a non-existent product', async () => {
    const res = await request(app).get('/products/999999').expect(404);
    expect(res.body).toMatchObject({ error: expect.any(String) });
  });
});
