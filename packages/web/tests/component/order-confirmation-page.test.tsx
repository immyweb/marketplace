import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { server } from "./setup";
import { http, HttpResponse } from "msw";
import { order } from "./msw-handlers";
import OrderConfirmationPage from "@/app/order-confirmation/[id]/page";

vi.mock("next/headers", () => ({
  headers: () => Promise.resolve(new Headers({ cookie: "session=abc123" })),
}));

function renderPage(id: string) {
  return OrderConfirmationPage({ params: Promise.resolve({ id }) });
}

describe("OrderConfirmationPage", () => {
  it("renders order details for a known order", async () => {
    render(await renderPage(String(order.id)));

    expect(
      screen.getByRole("article", { name: "Order confirmation" }),
    ).toBeInTheDocument();
    expect(screen.getByText(`#${order.id}`)).toBeInTheDocument();
    expect(
      screen.getByText(
        `${order.items[0].product.name} × ${order.items[0].quantity} — £${order.items[0].price.toFixed(2)}`,
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByLabelText(`Total: £${order.total_price.toFixed(2)}`),
    ).toBeInTheDocument();
  });

  it("renders the delivery address", async () => {
    render(await renderPage(String(order.id)));

    const delivery = screen.getByRole("region", { name: "Delivery details" });
    expect(delivery).toHaveTextContent(order.address_details.name);
    expect(delivery).toHaveTextContent(order.address_details.street);
    expect(delivery).toHaveTextContent(order.address_details.city);
    expect(delivery).toHaveTextContent(order.address_details.postcode);
  });

  it("renders the last four digits of the card used for payment", async () => {
    render(await renderPage(String(order.id)));

    expect(
      screen.getByText(
        `Card ending in ${order.payment_details.card_last_four_digits}`,
      ),
    ).toBeInTheDocument();
  });

  it("forwards the session cookie when fetching the order", async () => {
    let receivedCookie: string | null = null;
    server.use(
      http.get("http://localhost:3001/order/:id", ({ request }) => {
        receivedCookie = request.headers.get("cookie");
        return HttpResponse.json(order);
      }),
    );

    await renderPage(String(order.id));

    expect(receivedCookie).toBe("session=abc123");
  });

  it("throws a Next.js not-found error for an unknown order id", async () => {
    server.use(
      http.get("http://localhost:3001/order/:id", () =>
        HttpResponse.json({ error: "Order not found" }, { status: 404 }),
      ),
    );

    await expect(renderPage("999999")).rejects.toMatchObject({
      digest: "NEXT_HTTP_ERROR_FALLBACK;404",
    });
  });
});
