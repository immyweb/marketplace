import Link from "next/link";
import { headers } from "next/headers";
import { fetchCart } from "@/lib/api";

export async function Nav() {
  let itemCount = 0;
  try {
    // SSR fetches have no browser cookie jar — forward the incoming
    // request's Cookie header so the API sees the visitor's session.
    const cookie = (await headers()).get("cookie");
    const cart = await fetchCart(
      cookie ? { headers: { Cookie: cookie } } : undefined,
    );
    itemCount = cart.items.reduce((sum, item) => sum + item.quantity, 0);
  } catch {
    // cart fetch fails gracefully — show 0
  }

  return (
    <header className="bg-primary text-primary-foreground">
      <nav
        aria-label="Main navigation"
        className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6"
      >
        <Link
          href="/"
          aria-label="Marketplace home"
          className="font-display text-lg font-bold tracking-wide uppercase"
        >
          Marketplace <span className="text-accent">·</span> Goods
        </Link>
        <Link
          href="/cart"
          aria-label={`Cart, ${itemCount} item${itemCount !== 1 ? "s" : ""}`}
          className="font-mono text-sm tracking-wide uppercase hover:text-accent"
        >
          Cart
          <span aria-hidden="true" className="ml-1 text-accent">
            ({itemCount})
          </span>
        </Link>
      </nav>
    </header>
  );
}
