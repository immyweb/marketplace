import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { server } from "./setup";
import { cart } from "./msw-handlers";
import CheckoutPage from "@/app/checkout/page";
import { useStripe, useElements } from "@stripe/react-stripe-js";
import type { Stripe, StripeElements } from "@stripe/stripe-js";

const API_URL = "http://localhost:3001";

const { push } = vi.hoisted(() => ({ push: vi.fn() }));

vi.mock("next/navigation", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/navigation")>()),
  useRouter: () => ({ push, refresh: vi.fn() }),
}));

// Stub Stripe Elements so tests don't need a real Stripe iframe: `Elements`
// just renders its children, `CardElement` is a placeholder div, and
// `useStripe`/`useElements` are controllable per-test via vi.fn().
vi.mock("@stripe/react-stripe-js", () => ({
  Elements: ({ children }: { children: React.ReactNode }) => children,
  CardElement: () => <div data-testid="card-element" />,
  useStripe: vi.fn(),
  useElements: vi.fn(),
}));

function fillAddress(
  overrides: Partial<{
    name: string;
    street: string;
    city: string;
    postcode: string;
  }> = {},
) {
  const values = {
    name: "Ada Lovelace",
    street: "12 Analytical Engine Ave",
    city: "London",
    postcode: "SW1A 2AA",
    ...overrides,
  };
  fireEvent.change(screen.getByLabelText("Full name"), {
    target: { value: values.name },
  });
  fireEvent.change(screen.getByLabelText("Street address"), {
    target: { value: values.street },
  });
  fireEvent.change(screen.getByLabelText("City"), {
    target: { value: values.city },
  });
  fireEvent.change(screen.getByLabelText("Postcode"), {
    target: { value: values.postcode },
  });
}

describe("CheckoutPage", () => {
  beforeEach(() => {
    push.mockClear();
    // Only the members the checkout page actually calls are stubbed; cast
    // through `unknown` since a full Stripe/StripeElements mock isn't needed.
    vi.mocked(useStripe).mockReturnValue({
      confirmCardPayment: vi.fn(),
    } as unknown as Stripe);
    vi.mocked(useElements).mockReturnValue({
      getElement: vi.fn(),
    } as unknown as StripeElements);
  });

  it("renders the address form fields once the cart loads", async () => {
    render(<CheckoutPage />);

    expect(await screen.findByLabelText("Full name")).toBeInTheDocument();
    expect(screen.getByLabelText("Street address")).toBeInTheDocument();
    expect(screen.getByLabelText("City")).toBeInTheDocument();
    expect(screen.getByLabelText("Postcode")).toBeInTheDocument();
  });

  it("shows validation errors when submitting an empty form", async () => {
    render(<CheckoutPage />);
    await screen.findByLabelText("Full name");

    fireEvent.click(screen.getByRole("button", { name: "Place Order" }));

    expect(
      await screen.findByText("Full name is required"),
    ).toBeInTheDocument();
    expect(screen.getByText("Street address is required")).toBeInTheDocument();
    expect(screen.getByText("City is required")).toBeInTheDocument();
    expect(screen.getByText("Enter a valid UK postcode")).toBeInTheDocument();
  });

  it("disables the submit button while Stripe hasn't loaded", async () => {
    vi.mocked(useStripe).mockReturnValue(null);

    render(<CheckoutPage />);
    await screen.findByLabelText("Full name");

    expect(screen.getByRole("button", { name: "Place Order" })).toBeDisabled();
  });

  it("submits a valid address, confirms payment, and navigates to the order confirmation page", async () => {
    const confirmCardPayment = vi.fn().mockResolvedValue({
      paymentIntent: { id: "pi_123" },
      error: undefined,
    });
    vi.mocked(useStripe).mockReturnValue({
      confirmCardPayment,
    } as unknown as Stripe);
    vi.mocked(useElements).mockReturnValue({
      getElement: vi.fn().mockReturnValue({}),
    } as unknown as StripeElements);

    server.use(
      http.post(`${API_URL}/checkout/payment-intent`, () =>
        HttpResponse.json({ clientSecret: "secret_123", amount: 3798 }),
      ),
      http.post(`${API_URL}/order`, () =>
        HttpResponse.json({
          id: 42,
          total_price: cart.total_price,
          currency: "GBP",
          status: "paid",
          items: [],
          address_details: {
            name: "Ada Lovelace",
            street: "12 Analytical Engine Ave",
            city: "London",
            postcode: "SW1A 2AA",
          },
          payment_details: { card_last_four_digits: "4242" },
        }),
      ),
    );

    render(<CheckoutPage />);
    await screen.findByLabelText("Full name");
    fillAddress();

    fireEvent.click(screen.getByRole("button", { name: "Place Order" }));

    await waitFor(() =>
      expect(push).toHaveBeenCalledWith("/order-confirmation/42"),
    );
    expect(confirmCardPayment).toHaveBeenCalled();
  });
});
