import Link from "next/link";
import { headers } from "next/headers";
import { fetchCart } from "@/lib/api";
import { getServerSession } from "@/lib/get-server-session";
import { AccountMenu } from "@/components/account-menu";
import { MobileNavMenu } from "@/components/mobile-nav-menu";

export async function Nav() {
  // SSR fetches have no browser cookie jar — forward the incoming
  // request's Cookie header so the API sees the visitor's session.
  const cookie = (await headers()).get("cookie");

  const [cart, session] = await Promise.all([
    fetchCart(cookie ? { headers: { Cookie: cookie } } : undefined).catch(
      () => null, // cart fetch fails gracefully — show 0
    ),
    getServerSession(),
  ]);

  const itemCount = cart
    ? cart.items.reduce((sum, item) => sum + item.quantity, 0)
    : 0;

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
        <div className="flex items-center gap-8">
          <div className="hidden sm:block">
            {session ? (
              <AccountMenu name={session.user.name} />
            ) : (
              <Link
                href="/sign-in"
                className="font-mono text-sm tracking-wide uppercase hover:text-accent"
              >
                Sign in
              </Link>
            )}
          </div>
          <div className="sm:hidden">
            <MobileNavMenu name={session?.user.name ?? null} />
          </div>
          <Link
            href="/cart"
            aria-label={`Cart, ${itemCount} item${itemCount !== 1 ? "s" : ""}`}
            className="border-l border-primary-foreground/30 pl-6 font-mono text-sm tracking-wide uppercase hover:text-accent"
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
