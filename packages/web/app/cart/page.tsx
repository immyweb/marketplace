import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import { fetchCart } from "@/lib/api";
import { CartItemRow } from "@/components/cart-item-row";

export const metadata: Metadata = { title: "Your Cart" };

export default async function CartPage() {
  // SSR fetches have no browser cookie jar — forward the incoming
  // request's Cookie header so the API sees the visitor's session.
  const cookie = (await headers()).get("cookie");
  const cart = await fetchCart(
    cookie ? { headers: { Cookie: cookie } } : undefined,
  );

  if (cart.items.length === 0) {
    return (
      <>
        <h1 className="text-2xl font-semibold">Your Cart</h1>
        <p className="mt-4 text-muted-foreground">Your cart is empty.</p>
        <Link
          href="/"
          className="mt-4 inline-block text-sm font-medium underline"
        >
          Continue Shopping
        </Link>
      </>
    );
  }

  return (
    <>
      <h1 className="text-2xl font-semibold">Your Cart</h1>
      <ul aria-label="Cart items" className="mt-6 list-none p-0">
        {cart.items.map((item, index) => (
          <CartItemRow
            key={item.product.id}
            item={item}
            isFirst={index === 0}
          />
        ))}
      </ul>
      <div className="mt-6 flex items-center justify-between">
        <p
          aria-label={`Order total: £${cart.total_price.toFixed(2)}`}
          className="text-lg font-medium"
        >
          Total: £{cart.total_price.toFixed(2)}
        </p>
        <Link
          href="/checkout"
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-xs hover:bg-primary/90"
        >
          Proceed to Checkout
        </Link>
      </div>
    </>
  );
}
