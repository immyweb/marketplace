"use client";

import Image from "next/image";
import { useState } from "react";
import { cn } from "@/lib/utils";

interface Props {
  images: string[];
  productName: string;
}

export function ProductGallery({ images, productName }: Props) {
  const [selected, setSelected] = useState(0);

  if (images.length === 0) {
    return <p>No images to display</p>;
  }

  return (
    <div>
      <Image
        src={images[selected]}
        alt={productName}
        width={800}
        height={800}
        loading="eager"
        sizes="(max-width: 1024px) 100vw, 50vw"
        className="aspect-square w-full rounded-sm object-cover"
      />
      {images.length > 1 && (
        <div
          role="list"
          aria-label="Product images"
          className="mt-3 flex gap-2"
        >
          {images.map((src, i) => (
            <button
              key={src}
              role="listitem"
              onClick={() => setSelected(i)}
              aria-label={`View image ${i + 1}`}
              aria-pressed={selected === i}
              className={cn(
                "overflow-hidden rounded-sm border-2",
                selected === i ? "border-secondary" : "border-transparent",
              )}
            >
              <Image
                src={src}
                alt={`${productName} view ${i + 1}`}
                width={80}
                height={80}
                // Next tracks LCP-eager state per src, not per element. When a
                // thumbnail shares its src with the eager-loaded hero image
                // above (e.g. the first thumbnail is often the same photo),
                // a "lazy" registration here overwrites the hero's "eager"
                // one and reintroduces the LCP warning for that src.
                loading={src === images[0] ? "eager" : "lazy"}
                sizes="80px"
                className="aspect-square object-cover"
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
