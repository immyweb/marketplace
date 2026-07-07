import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { AddedToCartModal } from "@/app/products/[id]/_components";

const { push } = vi.hoisted(() => ({ push: vi.fn() }));

vi.mock("next/navigation", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/navigation")>()),
  useRouter: () => ({ push, refresh: vi.fn() }),
}));

describe("AddedToCartModal", () => {
  beforeEach(() => {
    push.mockClear();
  });

  it("renders nothing when closed", () => {
    render(<AddedToCartModal open={false} onOpenChange={vi.fn()} />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("renders the success message and both actions when open", () => {
    render(<AddedToCartModal open={true} onOpenChange={vi.fn()} />);

    expect(
      screen.getByRole("dialog", { name: "Added to Cart" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Successfully added to cart.")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Continue Shopping" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Checkout" }),
    ).toBeInTheDocument();
  });

  it("closes and navigates to the catalog when Continue Shopping is clicked", () => {
    const onOpenChange = vi.fn();
    render(<AddedToCartModal open={true} onOpenChange={onOpenChange} />);

    fireEvent.click(screen.getByRole("button", { name: "Continue Shopping" }));

    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(push).toHaveBeenCalledWith("/");
  });

  it("closes and navigates to checkout when Checkout is clicked", () => {
    const onOpenChange = vi.fn();
    render(<AddedToCartModal open={true} onOpenChange={onOpenChange} />);

    fireEvent.click(screen.getByRole("button", { name: "Checkout" }));

    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(push).toHaveBeenCalledWith("/checkout");
  });

  it("closes without navigating when Escape is pressed", () => {
    const onOpenChange = vi.fn();
    render(<AddedToCartModal open={true} onOpenChange={onOpenChange} />);

    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });

    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(push).not.toHaveBeenCalled();
  });
});
