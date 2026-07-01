'use client'

import Image from 'next/image'
import { useState } from 'react'

interface Props {
  images: string[]
  productName: string
}

export function ProductGallery({ images, productName }: Props) {
  const [selected, setSelected] = useState(0)

  if (images.length === 0) return null

  return (
    <div>
      <Image
        src={images[selected]}
        alt={productName}
        width={800}
        height={800}
        priority
        style={{ width: '100%', height: 'auto', objectFit: 'cover' }}
      />
      {images.length > 1 && (
        <div role="list" aria-label="Product images">
          {images.map((src, i) => (
            <button
              key={src}
              role="listitem"
              onClick={() => setSelected(i)}
              aria-label={`View image ${i + 1}`}
              aria-pressed={selected === i}
            >
              <Image
                src={src}
                alt={`${productName} view ${i + 1}`}
                width={80}
                height={80}
                style={{ objectFit: 'cover' }}
              />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
