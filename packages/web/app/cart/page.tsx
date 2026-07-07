import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import { fetchCart } from "@/lib/api";
import { CartItemRow } from "@/app/cart/_components";

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
        <p className="font-mono text-xs tracking-widest text-muted-foreground uppercase">
          Requisition No. —
        </p>
        <h1 className="mt-1 text-2xl">Your Cart</h1>
        <div className="mt-8 inline-block -rotate-2 border-2 border-dashed border-muted-foreground/40 px-6 py-4">
          <p className="font-mono text-xs tracking-widest text-muted-foreground uppercase">
            Docket Empty
          </p>
        </div>
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

  const itemCount = cart.items.reduce((sum, item) => sum + item.quantity, 0);
  const requisitionNo =
    cart.id !== null ? String(cart.id).padStart(6, "0") : "—";

  return (
    <div className="max-w-2xl">
      <p className="font-mono text-xs tracking-widest text-muted-foreground uppercase">
        Requisition No. {requisitionNo}
      </p>
      <h1 className="mt-1 text-2xl">Your Cart</h1>

      <div className="mt-6 hidden items-center gap-4 border-b border-border pb-2 sm:flex">
        <span className="w-6 shrink-0 font-mono text-xs tracking-widest text-muted-foreground uppercase">
          No.
        </span>
        <span aria-hidden="true" className="w-20 shrink-0" />
        <span className="flex flex-1 items-center justify-between font-mono text-xs tracking-widest text-muted-foreground uppercase">
          <span>Item</span>
          <span>Total</span>
        </span>
      </div>

      <ul
        aria-label="Cart items"
        className="list-none border-t border-dashed border-border p-0 sm:border-t-0"
      >
        {cart.items.map((item, index) => (
          <CartItemRow key={item.product.id} item={item} index={index} />
        ))}
      </ul>

      <div className="mt-2 border-t-2 border-primary pt-8">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div>
            <p className="font-mono text-xs tracking-widest text-muted-foreground uppercase">
              Subtotal · {itemCount} {itemCount === 1 ? "item" : "items"}
            </p>
            <div className="mt-2 inline-block animate-[stamp-press_0.5s_ease-out_both] border-2 border-primary bg-card px-4 py-2">
              <p
                aria-label={`Order total: £${cart.total_price.toFixed(2)}`}
                className="font-display text-xl font-bold tracking-wide text-primary uppercase"
              >
                Total £{cart.total_price.toFixed(2)}
              </p>
            </div>
          </div>
          <Link
            href="/checkout"
            className="rounded-sm bg-primary px-5 py-2.5 font-mono text-sm tracking-wide text-primary-foreground uppercase hover:bg-primary/90"
          >
            Proceed to Checkout
          </Link>
        </div>
      </div>
    </div>
  );
}
