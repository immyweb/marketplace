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
