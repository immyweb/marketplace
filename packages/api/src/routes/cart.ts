import { Router } from 'express';
import { prisma } from '../db/prisma.js';
import { AddToCartSchema, UpdateCartItemSchema } from '@marketplace/core';
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

router.post('/products', async (req, res, next) => {
  try {
    const parsed = AddToCartSchema.safeParse(req.body);
    if (!parsed.success) {
      res
        .status(400)
        .json({ error: parsed.error.errors[0].message, code: 'INVALID_INPUT' });
      return;
    }
    const { productId, quantity } = parsed.data;

    const product = await prisma.product.findUnique({
      where: { id: productId }
    });
    if (!product) {
      res.status(404).json({ error: 'Product not found', code: 'NOT_FOUND' });
      return;
    }

    let cart;
    if (req.session.cartId) {
      cart = await prisma.cart.findUnique({
        where: { id: req.session.cartId }
      });
    }

    if (!cart) {
      cart = await prisma.cart.create({ data: { session_id: req.session.id } });
      req.session.cartId = cart.id;
    }

    await prisma.cartItem.upsert({
      where: {
        cart_id_product_id: { cart_id: cart.id, product_id: productId }
      },
      update: { quantity: { increment: quantity } },
      create: { cart_id: cart.id, product_id: productId, quantity }
    });

    const updated = await prisma.cart.findUniqueOrThrow({
      where: { id: cart.id },
      include: cartInclude
    });

    res.json(formatCart(updated));
  } catch (err) {
    next(err);
  }
});

router.put('/products/:productId', async (req, res, next) => {
  try {
    const productId = parseInt(req.params.productId, 10);
    const parsed = UpdateCartItemSchema.safeParse(req.body);

    if (isNaN(productId) || !parsed.success) {
      res.status(400).json({
        error: parsed.success
          ? 'Invalid productId'
          : parsed.error.errors[0].message,
        code: 'INVALID_INPUT'
      });
      return;
    }
    const { quantity } = parsed.data;

    if (!req.session.cartId) {
      res.status(404).json({ error: 'Cart not found', code: 'NOT_FOUND' });
      return;
    }

    const cartItem = await prisma.cartItem.findUnique({
      where: {
        cart_id_product_id: {
          cart_id: req.session.cartId,
          product_id: productId
        }
      }
    });

    if (!cartItem) {
      res.status(404).json({ error: 'Item not in cart', code: 'NOT_FOUND' });
      return;
    }

    if (quantity === 0) {
      await prisma.cartItem.delete({
        where: {
          cart_id_product_id: {
            cart_id: req.session.cartId,
            product_id: productId
          }
        }
      });
    } else {
      await prisma.cartItem.update({
        where: {
          cart_id_product_id: {
            cart_id: req.session.cartId,
            product_id: productId
          }
        },
        data: { quantity }
      });
    }

    const cart = await prisma.cart.findUniqueOrThrow({
      where: { id: req.session.cartId },
      include: cartInclude
    });

    res.json(formatCart(cart));
  } catch (err) {
    next(err);
  }
});

export { formatCart, cartInclude };
export default router;
