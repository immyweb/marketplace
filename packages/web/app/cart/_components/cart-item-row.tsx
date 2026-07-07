"use client";

import Image from "next/image";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { updateCartItem, removeFromCart } from "@/lib/api";
import { Button } from "@/components/ui/button";
import type { CartItem } from "@marketplace/core";

interface Props {
  item: CartItem;
  index: number;
}

export function CartItemRow({ item, index }: Props) {
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
    <li
      aria-label={item.product.name}
      style={{ animationDelay: `${index * 60}ms` }}
      className="flex animate-[cart-row-in_0.4s_ease-out_both] gap-4 border-b border-dashed border-border py-5"
    >
      <span
        aria-hidden="true"
        className="w-6 shrink-0 pt-1 font-mono text-xs text-muted-foreground"
      >
        {String(index + 1).padStart(2, "0")}
      </span>
      <Image
        src={item.product.primary_image}
        alt={item.product.name}
        width={80}
        height={80}
        loading={index === 0 ? "eager" : "lazy"}
        className="aspect-square w-20 shrink-0 self-start rounded-sm object-cover"
      />
      <div className="flex flex-1 flex-col gap-3">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-medium">{item.product.name}</p>
            <p className="mt-1 font-mono text-[11px] tracking-wide text-muted-foreground uppercase">
              Item No. {String(item.product.id).padStart(5, "0")}
            </p>
          </div>
          <p
            aria-label={`Item total: £${item.price.toFixed(2)}`}
            className="shrink-0 font-mono text-sm text-secondary"
          >
            £{item.price.toFixed(2)}
          </p>
        </div>
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
