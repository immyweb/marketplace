import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { server } from "@/test-support/setup";
import { orderSummaries } from "@/test-support/msw-handlers";
import OrdersPage from "@/app/orders/page";

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

describe("OrdersPage", () => {
  it("redirects to sign-in when there is no session", async () => {
    server.use(
      http.get(`${API_URL}/api/auth/get-session`, () =>
        HttpResponse.json(null),
      ),
    );

    await expect(
      OrdersPage({ searchParams: Promise.resolve({}) }),
    ).rejects.toThrow("REDIRECT:/sign-in?redirect=/orders");
  });

  it("shows an empty state when the user has no orders", async () => {
    mockSignedIn();
    server.use(
      http.get(`${API_URL}/order`, () =>
        HttpResponse.json({ results: [], total: 0, page: 1, totalPages: 1 }),
      ),
    );

    render(await OrdersPage({ searchParams: Promise.resolve({}) }));

    expect(
      screen.getByText("You haven't placed any orders yet."),
    ).toBeInTheDocument();
  });

  it("lists the user's orders, linking each to its detail page", async () => {
    mockSignedIn();

    render(await OrdersPage({ searchParams: Promise.resolve({}) }));

    const list = screen.getByRole("list", { name: "Order history" });
    expect(list).toHaveTextContent(`#${orderSummaries[0].id}`);
    expect(list).toHaveTextContent(
      `£${orderSummaries[0].total_price.toFixed(2)}`,
    );
    expect(list).toHaveTextContent(orderSummaries[0].status);

    const link = screen.getByRole("link", {
      name: new RegExp(`#${orderSummaries[0].id}`),
    });
    expect(link).toHaveAttribute("href", `/orders/${orderSummaries[0].id}`);
  });
});
