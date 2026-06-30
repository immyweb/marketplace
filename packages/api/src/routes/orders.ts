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

    // Ensure the cart belongs to the current session to prevent IDOR
    if (cartId !== req.session.cartId) {
      res.status(403).json({ error: 'Cart does not belong to this session', code: 'FORBIDDEN' });
      return;
    }

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

    // Use a transaction so order creation and cart deletion are atomic.
    // If the process crashes between these two steps, we'd otherwise end
    // up with a dangling order and a cart that can be re-ordered.
    const order = await prisma.$transaction(async (tx) => {
      const created = await tx.order.create({
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
      await tx.cart.delete({ where: { id: cartId } });
      return created;
    });

    req.session.cartId = undefined;

    const response = {
      id: order.id,
      total_price: Number(order.total_price),
      currency: order.currency,
      status: order.status,
      items: order.items.map((item) => ({
        quantity: item.quantity,
        price: Number(item.price),
        currency: item.product.currency,
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
