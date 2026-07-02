import { describe, it, expect, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { server } from "./setup";
import { cart, emptyCart } from "./msw-handlers";
import CartPage from "@/app/cart/page";

// next/headers relies on Next's request-scoped AsyncLocalStorage, which
// only exists inside a real request (dev/prod server). It isn't populated
// in this jsdom test environment, so we stub it the same way
// product-detail-page.test.tsx stubs next/navigation's useRouter.
vi.mock("next/headers", () => ({
  headers: () => Promise.resolve(new Headers()),
}));

vi.mock("next/navigation", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/navigation")>()),
  useRouter: () => ({ refresh: vi.fn() }),
}));

describe("CartPage", () => {
  it("renders cart items with name, quantity, and price", async () => {
    render(await CartPage());

    const list = screen.getByRole("list", { name: "Cart items" });
    const item = cart.items[0];
    const row = within(list).getByRole("listitem", { name: item.product.name });
    expect(row).toBeInTheDocument();
    expect(within(row).getByText(item.product.name)).toBeInTheDocument();
    expect(
      within(row).getByLabelText(`Quantity: ${item.quantity}`),
    ).toBeInTheDocument();
    expect(
      within(row).getByLabelText(`Item total: £${item.price.toFixed(2)}`),
    ).toBeInTheDocument();
  });

  it("renders the order total and a checkout link", async () => {
    render(await CartPage());

    expect(
      screen.getByLabelText(`Order total: £${cart.total_price.toFixed(2)}`),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Proceed to Checkout" }),
    ).toBeInTheDocument();
  });

  it("shows an empty state when there are no items in the cart", async () => {
    server.use(
      http.get("http://localhost:3001/cart", () =>
        HttpResponse.json(emptyCart),
      ),
    );

    render(await CartPage());

    expect(screen.getByText("Your cart is empty.")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Continue Shopping" }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("list")).not.toBeInTheDocument();
  });
});
