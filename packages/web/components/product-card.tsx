import Image from 'next/image'
import Link from 'next/link'

interface Props {
  id: number
  name: string
  primary_image: string
  unit_price: number
  currency: string
}

export function ProductCard({ id, name, primary_image, unit_price, currency }: Props) {
  return (
    <article>
      <Link href={`/products/${id}`}>
        <Image
          src={primary_image}
          alt={name}
          width={400}
          height={400}
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
          style={{ width: '100%', height: 'auto', aspectRatio: '1 / 1', objectFit: 'cover' }}
        />
        <h2>{name}</h2>
        <p aria-label={`Price: ${currency} ${unit_price.toFixed(2)}`}>
          {currency === 'GBP' ? '£' : currency}{unit_price.toFixed(2)}
        </p>
      </Link>
    </article>
  )
}
