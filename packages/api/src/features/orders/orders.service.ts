import type Stripe from "stripe";
import type { Prisma } from "@prisma/client";
import type { AddressInput } from "@marketplace/core";
import { prisma } from "@/shared/db/prisma";
import { NotFoundError, PaymentFailedError } from "@/shared/errors";
import { stripe } from "@/shared/stripe";

type OrderWithItems = Prisma.OrderGetPayload<{
  include: { items: { include: { product: true } } };
}>;

const orderInclude = {
  items: { include: { product: true } },
} satisfies Prisma.OrderInclude;

function formatOrder(order: OrderWithItems) {
  return {
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
        primary_image: item.product.primary_image,
      },
    })),
    address_details: {
      name: order.address_name,
      street: order.address_street,
      city: order.address_city,
      postcode: order.address_postcode,
    },
    payment_details: {
      card_last_four_digits: order.card_last_four,
    },
  };
}

export type OrderDTO = ReturnType<typeof formatOrder>;

export async function placeOrder(params: {
  cartId: number;
  paymentIntentId: string;
  addressDetails: AddressInput;
  userId: string;
}): Promise<OrderDTO> {
  const { cartId, paymentIntentId, addressDetails, userId } = params;

  let paymentIntent: Stripe.PaymentIntent;
  try {
    paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId, {
      expand: ["payment_method"],
    });
  } catch {
    throw new PaymentFailedError("Invalid payment intent");
  }

  if (paymentIntent.status !== "succeeded") {
    throw new PaymentFailedError("Payment not completed");
  }

  const cart = await prisma.cart.findUnique({
    where: { id: cartId },
    include: { items: { include: { product: true } } },
  });

  if (!cart || cart.items.length === 0) {
    throw new NotFoundError("Cart not found or empty");
  }

  const orderItems = cart.items.map((item) => ({
    product_id: item.product_id,
    quantity: item.quantity,
    price: Number(item.product.unit_price) * item.quantity,
  }));

  const totalPrice = orderItems.reduce((sum, item) => sum + item.price, 0);

  // Guard against product prices changing between payment-intent creation
  // and order placement: the amount actually charged must match what the
  // cart costs right now, or the customer/order total would silently drift
  // from what Stripe collected.
  if (paymentIntent.amount !== Math.round(totalPrice * 100)) {
    throw new PaymentFailedError("Payment amount does not match cart total");
  }

  const pm = paymentIntent.payment_method;

  if (!pm || typeof pm !== "object" || pm.type !== "card" || !pm.card?.last4) {
    console.error(
      "[placeOrder] ALERT: Stripe PaymentIntent succeeded but card last4 is unreadable. " +
        `paymentIntentId=${paymentIntentId} cartId=${cartId} pm_type=${typeof pm === "object" && pm !== null ? (pm as Stripe.PaymentMethod).type : typeof pm}. ` +
        "Customer has been charged but no order was created. Manual reconciliation required.",
    );
    throw new PaymentFailedError(
      "Could not read card details from payment",
      500,
    );
  }

  const cardLastFour = pm.card.last4;

  // Use a transaction so order creation and cart deletion are atomic.
  // If the process crashes between these two steps, we'd otherwise end
  // up with a dangling order and a cart that can be re-ordered.
  const order = await prisma.$transaction(async (tx) => {
    const created = await tx.order.create({
      data: {
        total_price: totalPrice,
        stripe_payment_id: paymentIntentId,
        card_last_four: cardLastFour,
        address_name: addressDetails.name,
        address_street: addressDetails.street,
        address_city: addressDetails.city,
        address_postcode: addressDetails.postcode,
        user_id: userId,
        items: { create: orderItems },
      },
      include: orderInclude,
    });
    await tx.cart.delete({ where: { id: cartId } });
    return created;
  });

  return formatOrder(order);
}

export async function getOrderById(id: number): Promise<OrderDTO> {
  const order = await prisma.order.findUnique({
    where: { id },
    include: orderInclude,
  });

  if (!order) {
    throw new NotFoundError("Order not found");
  }

  return formatOrder(order);
}
