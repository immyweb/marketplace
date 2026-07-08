import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { server } from "./setup";
import { order } from "./msw-handlers";
import OrderDetailPage from "@/app/orders/[id]/page";

const API_URL = "http://localhost:3001";

vi.mock("next/headers", () => ({
  headers: () => Promise.resolve(new Headers()),
}));

const { redirect } = vi.hoisted(() => ({
  redirect: vi.fn((url: string) => {
    throw new Error(`REDIRECT:${url}`);
  }),
}));

vi.mock("next/navigation", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/navigation")>()),
  redirect,
}));

function mockSignedIn() {
  server.use(
    http.get(`${API_URL}/api/auth/get-session`, () =>
      HttpResponse.json({
        session: {
          id: "s1",
          userId: "u1",
          expiresAt: new Date().toISOString(),
        },
        user: { id: "u1", name: "Ada", email: "ada@example.com" },
      }),
    ),
  );
}

function renderPage(id: string) {
  return OrderDetailPage({ params: Promise.resolve({ id }) });
}

describe("OrderDetailPage", () => {
  it("redirects to sign-in when there is no session", async () => {
    server.use(
      http.get(`${API_URL}/api/auth/get-session`, () =>
        HttpResponse.json(null),
      ),
    );

    await expect(renderPage(String(order.id))).rejects.toThrow(
      `REDIRECT:/sign-in?redirect=/orders/${order.id}`,
    );
  });

  it("renders order details for a known order", async () => {
    mockSignedIn();

    render(await renderPage(String(order.id)));

    expect(
      screen.getByRole("article", { name: "Order details" }),
    ).toBeInTheDocument();
    expect(screen.getByText(`Order #${order.id}`)).toBeInTheDocument();
    expect(
      screen.getByText(
        `${order.items[0].product.name} × ${order.items[0].quantity} — £${order.items[0].price.toFixed(2)}`,
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByLabelText(`Total: £${order.total_price.toFixed(2)}`),
    ).toBeInTheDocument();

    const delivery = screen.getByRole("region", { name: "Delivery details" });
    expect(delivery).toHaveTextContent(order.address_details.name);

    expect(
      screen.getByText(
        `Card ending in ${order.payment_details.card_last_four_digits}`,
      ),
    ).toBeInTheDocument();
  });

  it("throws a Next.js not-found error for an unknown order id", async () => {
    mockSignedIn();
    server.use(
      http.get(`${API_URL}/order/:id`, () =>
        HttpResponse.json({ error: "Order not found" }, { status: 404 }),
      ),
    );

    await expect(renderPage("999999")).rejects.toMatchObject({
      digest: "NEXT_HTTP_ERROR_FALLBACK;404",
    });
  });
});
