"use client";

import Image from "next/image";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { updateCartItem, removeFromCart } from "@/lib/api";
import { Button } from "@/components/ui/button";
import type { CartItem } from "@marketplace/core";

interface Props {
  item: CartItem;
  isFirst?: boolean;
}

export function CartItemRow({ item, isFirst }: Props) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleQuantityChange(newQty: number) {
    setLoading(true);
    try {
      await updateCartItem(item.product.id, newQty);
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  async function handleRemove() {
    setLoading(true);
    try {
      await removeFromCart(item.product.id);
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <li aria-label={item.product.name} className="flex gap-4 border-b py-4">
      <Image
        src={item.product.primary_image}
        alt={item.product.name}
        width={80}
        height={80}
        loading={isFirst ? "eager" : "lazy"}
        className="aspect-square self-start rounded-md object-cover"
      />
      <div className="flex flex-1 flex-col gap-2">
        <p className="text-sm font-medium">{item.product.name}</p>
        <p
          aria-label={`Item total: £${item.price.toFixed(2)}`}
          className="text-sm text-muted-foreground"
        >
          £{item.price.toFixed(2)}
        </p>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={() => handleQuantityChange(item.quantity - 1)}
            disabled={loading || item.quantity <= 1}
            aria-label="Decrease quantity"
          >
            −
          </Button>
          <span
            aria-label={`Quantity: ${item.quantity}`}
            className="w-6 text-center text-sm"
          >
            {item.quantity}
          </span>
          <Button
            variant="outline"
            size="icon"
            onClick={() => handleQuantityChange(item.quantity + 1)}
            disabled={loading}
            aria-label="Increase quantity"
          >
            +
          </Button>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleRemove}
          disabled={loading}
          aria-label={`Remove ${item.product.name}`}
          className="w-fit text-destructive hover:text-destructive"
        >
          Remove
        </Button>
      </div>
    </li>
  );
}
