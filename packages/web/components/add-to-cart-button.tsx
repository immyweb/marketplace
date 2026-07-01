'use client'

import { useState } from 'react'
import { addToCart } from '@/lib/api'
import { useRouter } from 'next/navigation'

interface Props {
  productId: number
}

export function AddToCartButton({ productId }: Props) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  async function handleClick() {
    setLoading(true)
    setError(null)
    try {
      await addToCart(productId, 1)
      router.refresh() // re-fetches Nav to update cart badge
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add to cart')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <button onClick={handleClick} disabled={loading} aria-busy={loading}>
        {loading ? 'Adding...' : 'Add to Cart'}
      </button>
      {error && <p role="alert">{error}</p>}
    </div>
  )
}
