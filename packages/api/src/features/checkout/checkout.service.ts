import { prisma } from "../../shared/db/prisma.js";
import { NotFoundError } from "../../shared/errors.js";
import { stripe } from "../../shared/stripe.js";

export async function createPaymentIntent(
  cartId: number,
): Promise<{ clientSecret: string; amount: number }> {
  const cart = await prisma.cart.findUnique({
    where: { id: cartId },
    include: { items: { include: { product: true } } },
  });

  if (!cart || cart.items.length === 0) {
    throw new NotFoundError("Cart not found or empty");
  }

  const totalPence = Math.round(
    cart.items.reduce(
      (sum, item) => sum + Number(item.product.unit_price) * item.quantity,
      0,
    ) * 100,
  );

  const paymentIntent = await stripe.paymentIntents.create({
    amount: totalPence,
    currency: "gbp",
    automatic_payment_methods: { enabled: true, allow_redirects: "never" },
    metadata: { cartId: String(cartId) },
  });

  if (!paymentIntent.client_secret) {
    throw new Error("Stripe did not return a client_secret");
  }

  return {
    clientSecret: paymentIntent.client_secret,
    amount: totalPence / 100,
  };
}
