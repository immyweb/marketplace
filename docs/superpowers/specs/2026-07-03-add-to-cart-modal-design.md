# Add to Cart Confirmation Modal

## Problem

Clicking "Add to Cart" on the product detail page currently only flips the button label optimistically ("Added to Cart") and silently updates the cart badge in the nav via `router.refresh()`. There's no explicit confirmation, and no direct path to checkout from the add-to-cart moment.

## Goals

- Show a modal confirming success, after the add-to-cart request actually succeeds (not optimistically).
- Modal message: "Successfully added to cart."
- Two actions: Continue Shopping (navigate to the catalog) and Checkout (navigate to checkout).
- Escape / backdrop dismissal behaves the same as Continue Shopping.
- Match existing Field Ledger design tokens and reuse the existing `Button` component.

## Non-Goals

- No change to the existing optimistic button label behavior — the button still flips to "Added to Cart" immediately on click, independent of the modal.
- No item details (name/quantity/price) in the modal — just the generic success message.
- No use elsewhere besides the PDP add-to-cart flow — it's the only add-to-cart entry point today.
- No hand-rolled modal — use `@radix-ui/react-dialog` (new dependency) for focus trapping, Escape handling, and ARIA, consistent with the existing `@radix-ui/react-slot` usage in `components/ui/button.tsx`.

## Design

### New dependency

`@radix-ui/react-dialog`, added to `packages/web`, imported as `import * as Dialog from "@radix-ui/react-dialog"` (scoped-package style, matching the existing `@radix-ui/react-slot` convention rather than the newer unified `radix-ui` package).

### Component: `components/added-to-cart-modal.tsx`

A controlled dialog taking `open` and `onOpenChange` props:

```tsx
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
    <Dialog.Root
      open={open}
      onOpenChange={(next) => {
        if (!next) close("/");
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay />
        <Dialog.Content>
          <Dialog.Title>Added to Cart</Dialog.Title>
          <Dialog.Description>Successfully added to cart.</Dialog.Description>
          <Button variant="outline" onClick={() => close("/")}>
            Continue Shopping
          </Button>
          <Button onClick={() => close("/checkout")}>Checkout</Button>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
```

Exact classNames (border, spacing, uppercase display title, dashed accents) are refined at implementation time against the Field Ledger tokens already defined in `globals.css`; the structure and behavior above are final.

### `AddToCartButton` changes

- Add `const [modalOpen, setModalOpen] = useState(false);`.
- Inside the existing transition, once `await addToCart(productId, 1)` resolves successfully, call `setModalOpen(true)`.
- On error (existing `catch` block), the modal is not opened — the existing inline error message path is unchanged.
- Render `<AddedToCartModal open={modalOpen} onOpenChange={setModalOpen} />` alongside the existing button and error markup.

### Behavior summary

| Trigger                      | Result                                                       |
| ---------------------------- | ------------------------------------------------------------ |
| Add-to-cart request succeeds | Modal opens                                                  |
| Add-to-cart request fails    | Modal never opens; existing inline error message shows       |
| "Continue Shopping" click    | Modal closes, `router.push("/")`                             |
| "Checkout" click             | Modal closes, `router.push("/checkout")`                     |
| Escape key / backdrop click  | Modal closes, `router.push("/")` (same as Continue Shopping) |

## Testing

- Extend `packages/web/tests/component/product-detail-page.test.tsx` with cases covering the modal:
  - Mock a successful `POST /cart/products` response (existing MSW handler already returns success) → assert a dialog appears (`role="dialog"`) with accessible name "Added to Cart" and text "Successfully added to cart.", and that both "Continue Shopping" and "Checkout" buttons are present.
  - Click "Continue Shopping" → assert the mocked `router.push` was called with `"/"`.
  - Click "Checkout" → assert the mocked `router.push` was called with `"/checkout"`.
  - Mock a failing `POST /cart/products` (e.g. 500) → assert the modal never opens (`queryByRole("dialog")` is null) and the existing inline error text still renders.
- No new E2E test: the PDP add-to-cart flow isn't in the critical-flow list (checkout/cart/payment). The existing `cart.spec.ts` e2e flow clicks "Add to Cart" then immediately checks the nav badge and navigates away via `page.goto("/cart")` — this is unaffected by the modal since Playwright's navigation doesn't require dismissing any on-page overlay first.
