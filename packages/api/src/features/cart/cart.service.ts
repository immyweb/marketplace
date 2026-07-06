import type { Prisma } from "@prisma/client";
import { prisma } from "../../shared/db/prisma";
import { NotFoundError } from "../../shared/errors";

type CartWithItems = Prisma.CartGetPayload<{
  include: { items: { include: { product: true } } };
}>;

const cartInclude = {
  items: { include: { product: true } },
} satisfies Prisma.CartInclude;

function formatCart(cart: CartWithItems) {
  const items = cart.items.map((item) => ({
    quantity: item.quantity,
    price: Number(item.product.unit_price) * item.quantity,
    currency: item.product.currency,
    product: {
      id: item.product.id,
      name: item.product.name,
      primary_image: item.product.primary_image,
    },
  }));

  return {
    id: cart.id,
    items,
    total_price: items.reduce((sum, item) => sum + item.price, 0),
    currency: "GBP",
  };
}

export type CartDTO = ReturnType<typeof formatCart>;

export async function findCartById(cartId: number): Promise<CartDTO | null> {
  const cart = await prisma.cart.findUnique({
    where: { id: cartId },
    include: cartInclude,
  });
  return cart ? formatCart(cart) : null;
}

export async function addProductToCart(
  cartId: number | null,
  sessionId: string,
  productId: number,
  quantity: number,
): Promise<{ cartId: number; cart: CartDTO }> {
  const product = await prisma.product.findUnique({
    where: { id: productId },
  });
  if (!product) {
    throw new NotFoundError("Product not found");
  }

  let resolvedCartId = cartId;
  if (resolvedCartId) {
    const existing = await prisma.cart.findUnique({
      where: { id: resolvedCartId },
    });
    if (!existing) resolvedCartId = null;
  }

  if (!resolvedCartId) {
    const created = await prisma.cart.create({
      data: { session_id: sessionId },
    });
    resolvedCartId = created.id;
  }

  await prisma.cartItem.upsert({
    where: {
      cart_id_product_id: { cart_id: resolvedCartId, product_id: productId },
    },
    update: { quantity: { increment: quantity } },
    create: { cart_id: resolvedCartId, product_id: productId, quantity },
  });

  const updated = await prisma.cart.findUniqueOrThrow({
    where: { id: resolvedCartId },
    include: cartInclude,
  });

  return { cartId: resolvedCartId, cart: formatCart(updated) };
}

export async function updateCartItemQuantity(
  cartId: number | null,
  productId: number,
  quantity: number,
): Promise<CartDTO> {
  if (!cartId) {
    throw new NotFoundError("Cart not found");
  }

  const cartItem = await prisma.cartItem.findUnique({
    where: { cart_id_product_id: { cart_id: cartId, product_id: productId } },
  });

  if (!cartItem) {
    throw new NotFoundError("Item not in cart");
  }

  if (quantity === 0) {
    await prisma.cartItem.delete({
      where: { cart_id_product_id: { cart_id: cartId, product_id: productId } },
    });
  } else {
    await prisma.cartItem.update({
      where: { cart_id_product_id: { cart_id: cartId, product_id: productId } },
      data: { quantity },
    });
  }

  const cart = await prisma.cart.findUniqueOrThrow({
    where: { id: cartId },
    include: cartInclude,
  });

  return formatCart(cart);
}

export async function removeCartItem(
  cartId: number | null,
  productId: number,
): Promise<CartDTO> {
  if (!cartId) {
    throw new NotFoundError("Cart not found");
  }

  await prisma.cartItem.deleteMany({
    where: { cart_id: cartId, product_id: productId },
  });

  const cart = await prisma.cart.findUniqueOrThrow({
    where: { id: cartId },
    include: cartInclude,
  });

  return formatCart(cart);
}
