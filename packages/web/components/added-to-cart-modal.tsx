"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AddedToCartModal({ open, onOpenChange }: Props) {
  const router = useRouter();

  function close(navigateTo: string) {
    onOpenChange(false);
    router.push(navigateTo);
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-foreground/40" />
        <Dialog.Content className="fixed top-1/2 left-1/2 w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-sm border border-border bg-card p-6 shadow-xs">
          <Dialog.Title className="font-display text-lg font-bold tracking-wide uppercase">
            Added to Cart
          </Dialog.Title>
          <Dialog.Description className="mt-2 text-sm text-muted-foreground">
            Successfully added to cart.
          </Dialog.Description>
          <div className="mt-6 flex justify-end gap-3">
            <Button variant="outline" onClick={() => close("/")}>
              Continue Shopping
            </Button>
            <Button onClick={() => close("/checkout")}>Checkout</Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
