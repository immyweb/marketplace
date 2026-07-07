import Link from "next/link";
import { headers } from "next/headers";
import { fetchCart } from "@/lib/api";
import { getServerSession } from "@/lib/get-server-session";
import { SignOutButton } from "@/components/sign-out-button";

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

  const session = await getServerSession();

  return (
    <header className="bg-primary text-primary-foreground">
      <nav
        aria-label="Main navigation"
        className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6"
      >
        <Link
          href="/"
          className="font-display text-lg font-bold tracking-wide uppercase"
        >
          Marketplace <span className="text-accent">·</span> Goods
        </Link>
        <div className="flex items-center gap-6">
          {session ? (
            <div className="flex items-center gap-3 font-mono text-sm tracking-wide uppercase">
              <span>{session.user.email}</span>
              <SignOutButton />
            </div>
          ) : (
            <Link
              href="/sign-in"
              className="font-mono text-sm tracking-wide uppercase hover:text-accent"
            >
              Sign in
            </Link>
          )}
          <Link
            href="/cart"
            aria-label={`Cart, ${itemCount} item${itemCount !== 1 ? "s" : ""}`}
            className="font-mono text-sm tracking-wide uppercase hover:text-accent"
          >
            Cart
            <span
              aria-hidden="true"
              className="ml-1.5 rounded-sm bg-accent px-1.5 py-0.5 text-xs text-foreground"
            >
              {itemCount}
            </span>
          </Link>
        </div>
      </nav>
    </header>
  );
}
