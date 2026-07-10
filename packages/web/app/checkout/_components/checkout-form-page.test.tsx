import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { server } from "@/test-support/setup";
import { cart, savedAddress } from "@/test-support/msw-handlers";
import { CheckoutFormPage } from "@/app/checkout/_components";
import { useStripe, useElements } from "@stripe/react-stripe-js";
import type { Stripe, StripeElements } from "@stripe/stripe-js";

const API_URL = "http://localhost:3001";

const { push, refresh } = vi.hoisted(() => ({
  push: vi.fn(),
  refresh: vi.fn(),
}));

vi.mock("next/navigation", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/navigation")>()),
  useRouter: () => ({ push, refresh }),
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

describe("CheckoutFormPage", () => {
  beforeEach(() => {
    push.mockClear();
    refresh.mockClear();
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
    render(<CheckoutFormPage />);

    expect(await screen.findByLabelText("Full name")).toBeInTheDocument();
    expect(screen.getByLabelText("Street address")).toBeInTheDocument();
    expect(screen.getByLabelText("City")).toBeInTheDocument();
    expect(screen.getByLabelText("Postcode")).toBeInTheDocument();
  });

  it("shows validation errors when submitting an empty form", async () => {
    render(<CheckoutFormPage />);
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

    render(<CheckoutFormPage />);
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

    render(<CheckoutFormPage />);
    await screen.findByLabelText("Full name");
    fillAddress();

    fireEvent.click(screen.getByRole("button", { name: "Place Order" }));

    await waitFor(() =>
      expect(push).toHaveBeenCalledWith("/order-confirmation/42"),
    );
    expect(confirmCardPayment).toHaveBeenCalled();
    expect(refresh).toHaveBeenCalled();
  });

  it("prefills the address fields when a saved address is passed in", async () => {
    render(<CheckoutFormPage savedAddress={savedAddress} />);

    expect(await screen.findByLabelText("Full name")).toHaveValue(
      savedAddress.name,
    );
    expect(screen.getByLabelText("Street address")).toHaveValue(
      savedAddress.street,
    );
    expect(screen.getByLabelText("City")).toHaveValue(savedAddress.city);
    expect(screen.getByLabelText("Postcode")).toHaveValue(
      savedAddress.postcode,
    );
  });

  it("renders blank when there is no saved address", async () => {
    render(<CheckoutFormPage savedAddress={null} />);

    expect(await screen.findByLabelText("Full name")).toHaveValue("");
    expect(screen.getByLabelText("Street address")).toHaveValue("");
    expect(screen.getByLabelText("City")).toHaveValue("");
    expect(screen.getByLabelText("Postcode")).toHaveValue("");
  });

  it("defaults the save-address checkbox to checked", async () => {
    render(<CheckoutFormPage />);
    await screen.findByLabelText("Full name");

    expect(
      screen.getByLabelText("Save this address for future orders"),
    ).toBeChecked();
  });

  it("sends saveAddress: false when the checkbox is unchecked", async () => {
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

    let capturedBody: { saveAddress?: boolean } | null = null;
    server.use(
      http.post(`${API_URL}/checkout/payment-intent`, () =>
        HttpResponse.json({ clientSecret: "secret_123", amount: 3798 }),
      ),
      http.post(`${API_URL}/order`, async ({ request }) => {
        capturedBody = (await request.json()) as { saveAddress?: boolean };
        return HttpResponse.json({
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
        });
      }),
    );

    render(<CheckoutFormPage />);
    await screen.findByLabelText("Full name");
    fillAddress();
    fireEvent.click(
      screen.getByLabelText("Save this address for future orders"),
    );

    fireEvent.click(screen.getByRole("button", { name: "Place Order" }));

    await waitFor(() => expect(push).toHaveBeenCalled());
    expect(capturedBody).toMatchObject({ saveAddress: false });
  });

  it("sends saveAddress: true when the checkbox is left checked", async () => {
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

    let capturedBody: { saveAddress?: boolean } | null = null;
    server.use(
      http.post(`${API_URL}/checkout/payment-intent`, () =>
        HttpResponse.json({ clientSecret: "secret_123", amount: 3798 }),
      ),
      http.post(`${API_URL}/order`, async ({ request }) => {
        capturedBody = (await request.json()) as { saveAddress?: boolean };
        return HttpResponse.json({
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
        });
      }),
    );

    render(<CheckoutFormPage />);
    await screen.findByLabelText("Full name");
    fillAddress();

    fireEvent.click(screen.getByRole("button", { name: "Place Order" }));

    await waitFor(() => expect(push).toHaveBeenCalled());
    expect(capturedBody).toMatchObject({ saveAddress: true });
  });
});
