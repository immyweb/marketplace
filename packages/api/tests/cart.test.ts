import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { agent } from 'supertest';
import { app } from '../src/app.js';
import { prisma } from '../src/db/prisma.js';

beforeEach(async () => {
  await prisma.cartItem.deleteMany();
  await prisma.cart.deleteMany();
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
