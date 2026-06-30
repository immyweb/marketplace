import { Router } from 'express';
import { prisma } from '../db/prisma.js';
import type { Prisma } from '@prisma/client';

const router = Router();

type CartWithItems = Prisma.CartGetPayload<{
  include: { items: { include: { product: true } } };
}>;

function formatCart(cart: CartWithItems) {
  const items = cart.items.map((item) => ({
    quantity: item.quantity,
    price: Number(item.product.unit_price) * item.quantity,
    currency: item.product.currency,
    product: {
      id: item.product.id,
      name: item.product.name,
      primary_image: item.product.primary_image
    }
  }));

  return {
    id: cart.id,
    items,
    total_price: items.reduce((sum, item) => sum + item.price, 0),
    currency: 'GBP'
  };
}

const cartInclude = {
  items: { include: { product: true } }
} satisfies Prisma.CartInclude;

router.get('/', async (req, res, next) => {
  try {
    if (!req.session.cartId) {
      res.json({ id: null, items: [], total_price: 0, currency: 'GBP' });
      return;
    }

    const cart = await prisma.cart.findUnique({
      where: { id: req.session.cartId },
      include: cartInclude
    });

    if (!cart) {
      req.session.cartId = undefined;
      res.json({ id: null, items: [], total_price: 0, currency: 'GBP' });
      return;
    }

    res.json(formatCart(cart));
  } catch (err) {
    next(err);
  }
});

export { formatCart, cartInclude };
export default router;
