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
      <div className="max-w-2xl">
        <h1 className="text-2xl">Your Cart</h1>
        <p className="mt-4 text-muted-foreground">Your cart is empty.</p>
        <Link
          href="/"
          className="mt-4 inline-block font-mono text-sm tracking-wide text-secondary underline underline-offset-4"
        >
          Continue Shopping
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl">Your Cart</h1>
      <ul
        aria-label="Cart items"
        className="mt-6 list-none border-t border-dashed border-border p-0"
      >
        {cart.items.map((item, index) => (
          <CartItemRow
            key={item.product.id}
            item={item}
            isFirst={index === 0}
          />
        ))}
      </ul>
      <div className="mt-6 flex items-center justify-between border-t-2 border-primary pt-4">
        <p
          aria-label={`Order total: £${cart.total_price.toFixed(2)}`}
          className="font-display text-lg font-bold tracking-wide uppercase"
        >
          Total: £{cart.total_price.toFixed(2)}
        </p>
        <Link
          href="/checkout"
          className="rounded-sm bg-primary px-5 py-2.5 font-mono text-sm tracking-wide text-primary-foreground uppercase hover:bg-primary/90"
        >
          Proceed to Checkout
        </Link>
      </div>
    </div>
  );
}
