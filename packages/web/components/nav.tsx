import Link from 'next/link'
import { fetchCart } from '@/lib/api'

export async function Nav() {
  let itemCount = 0
  try {
    const cart = await fetchCart()
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
