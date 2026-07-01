import Link from 'next/link'
import { headers } from 'next/headers'
import { fetchCart } from '@/lib/api'

export async function Nav() {
  let itemCount = 0
  try {
    // SSR fetches have no browser cookie jar — forward the incoming
    // request's Cookie header so the API sees the visitor's session.
    const cookie = (await headers()).get('cookie')
    const cart = await fetchCart(cookie ? { headers: { Cookie: cookie } } : undefined)
    itemCount = cart.items.reduce((sum, item) => sum + item.quantity, 0)
  } catch {
    // cart fetch fails gracefully — show 0
  }

  return (
    <header>
      <nav aria-label="Main navigation">
        <Link href="/" aria-label="Marketplace home">
          Marketplace
        </Link>
        <Link href="/cart" aria-label={`Cart, ${itemCount} item${itemCount !== 1 ? 's' : ''}`}>
          Cart
          {itemCount > 0 && (
            <span aria-hidden="true"> ({itemCount})</span>
          )}
        </Link>
      </nav>
    </header>
  )
}
