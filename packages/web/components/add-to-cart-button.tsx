"use client";

import { useState, useTransition } from "react";
import { addToCart } from "@/lib/api";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { AddedToCartModal } from "@/components/added-to-cart-modal";

interface Props {
  productId: number;
}

export function AddToCartButton({ productId }: Props) {
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function handleClick() {
    setError(null);
    startTransition(async () => {
      try {
        await addToCart(productId, 1);
        setModalOpen(true);
        // Kept in the same transition so the button stays disabled until
        // the refreshed nav badge is ready, instead of re-enabling while
        // the refresh is still in flight.
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to add to cart");
      }
    });
  }

  return (
    <div className="mt-4">
      <Button onClick={handleClick} disabled={isPending} aria-busy={isPending}>
        Add to Cart
      </Button>
      {error && (
        <p role="alert" className="mt-2 text-sm text-destructive">
          {error}
        </p>
      )}
      <AddedToCartModal open={modalOpen} onOpenChange={setModalOpen} />
    </div>
  );
}
