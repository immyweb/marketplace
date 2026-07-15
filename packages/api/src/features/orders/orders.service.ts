import type Stripe from "stripe";
import type { Prisma } from "@prisma/client";
import type { AddressInput, OrderSummary } from "@marketplace/core";
import { prisma } from "@/shared/db/prisma";
import { NotFoundError, PaymentFailedError } from "@/shared/errors";
import { stripe } from "@/shared/stripe";
import { logger } from "@/shared/logger";
import { sendOrderConfirmationEmail } from "./order-confirmation.email";

const orderInclude = {
  items: {
    include: {
      product: {
        select: {
          id: true,
          name: true,
          primary_image: true,
          currency: true,
        },
      },
    },
  },
  user: { select: { email: true, name: true } },
} satisfies Prisma.OrderInclude;

type OrderWithItems = Prisma.OrderGetPayload<{ include: typeof orderInclude }>;

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
  saveAddress: boolean;
  userId: string;
}): Promise<OrderDTO> {
  const { cartId, paymentIntentId, addressDetails, saveAddress, userId } =
    params;

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
    include: {
      items: { include: { product: { select: { unit_price: true } } } },
    },
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
    logger.error(
      {
        paymentIntentId,
        cartId,
        pmType:
          typeof pm === "object" && pm !== null
            ? (pm as Stripe.PaymentMethod).type
            : typeof pm,
      },
      "Stripe PaymentIntent succeeded but card last4 is unreadable; customer charged, no order created, manual reconciliation required",
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

    if (saveAddress) {
      await tx.user.update({
        where: { id: userId },
        data: {
          addressName: addressDetails.name,
          addressStreet: addressDetails.street,
          addressCity: addressDetails.city,
          addressPostcode: addressDetails.postcode,
        },
      });
    }

    await tx.cart.delete({ where: { id: cartId } });
    return created;
  });

  const orderDTO = formatOrder(order);
  await sendOrderConfirmationEmail(orderDTO, order.user.email, order.user.name);

  return orderDTO;
}

export async function getOrderById(
  id: number,
  userId: string,
): Promise<OrderDTO> {
  const order = await prisma.order.findUnique({
    where: { id },
    include: orderInclude,
  });

  if (!order || order.user_id !== userId) {
    throw new NotFoundError("Order not found");
  }

  return formatOrder(order);
}

const ORDERS_PAGE_SIZE = 10;

export async function listOrdersByUser(
  userId: string,
  page: number,
): Promise<{
  results: OrderSummary[];
  total: number;
  page: number;
  totalPages: number;
}> {
  const where = { user_id: userId };

  const [orders, total] = await Promise.all([
    prisma.order.findMany({
      where,
      orderBy: { created_at: "desc" },
      skip: (page - 1) * ORDERS_PAGE_SIZE,
      take: ORDERS_PAGE_SIZE,
      select: {
        id: true,
        created_at: true,
        status: true,
        total_price: true,
        currency: true,
        _count: { select: { items: true } },
      },
    }),
    prisma.order.count({ where }),
  ]);

  return {
    results: orders.map((order) => ({
      id: order.id,
      created_at: order.created_at.toISOString(),
      status: order.status,
      total_price: Number(order.total_price),
      currency: order.currency,
      item_count: order._count.items,
    })),
    total,
    page,
    totalPages: Math.ceil(total / ORDERS_PAGE_SIZE),
  };
}
