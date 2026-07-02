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
        priority
        sizes="(max-width: 1024px) 100vw, 50vw"
        className="aspect-square w-full rounded-md object-cover"
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
                "overflow-hidden rounded-md border-2",
                selected === i ? "border-primary" : "border-transparent",
              )}
            >
              <Image
                src={src}
                alt={`${productName} view ${i + 1}`}
                width={80}
                height={80}
                className="aspect-square object-cover"
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
