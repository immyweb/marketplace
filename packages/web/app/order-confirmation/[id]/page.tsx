import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ApiRequestError, fetchOrder } from "@/lib/api";

interface Props {
  params: Promise<{ id: string }>;
}

async function fetchOrderOrNotFound(id: number) {
  try {
    return await fetchOrder(id);
  } catch (err) {
    if (err instanceof ApiRequestError && err.status === 404) return null;
    throw err;
  }
}

export const metadata: Metadata = { title: "Order Confirmed" };

export default async function OrderConfirmationPage({ params }: Props) {
  const { id } = await params;
  const order = await fetchOrderOrNotFound(parseInt(id, 10));

  if (!order) notFound();

  return (
    <article aria-label="Order confirmation">
      <h1 className="text-2xl font-semibold">Order Confirmed</h1>
      <p className="mt-2 text-muted-foreground">
        Thank you for your order. Your order number is{" "}
        <strong>#{order.id}</strong>.
      </p>

      <section aria-label="Order summary" className="mt-6">
        <h2 className="text-lg font-medium">Order Summary</h2>
        <ul className="mt-2 list-none p-0">
          {order.items.map((item) => (
            <li key={item.product.id}>
              {item.product.name} × {item.quantity} — £{item.price.toFixed(2)}
            </li>
          ))}
        </ul>
        <p
          aria-label={`Total: £${order.total_price.toFixed(2)}`}
          className="mt-4 text-lg font-medium"
        >
          Total: £{order.total_price.toFixed(2)}
        </p>
      </section>

      <section aria-label="Delivery details" className="mt-6">
        <h2 className="text-lg font-medium">Delivering to</h2>
        <address className="not-italic">
          {order.address_details.name}
          <br />
          {order.address_details.street}
          <br />
          {order.address_details.city}
          <br />
          {order.address_details.postcode}
        </address>
      </section>

      <section aria-label="Payment details" className="mt-6">
        <h2 className="text-lg font-medium">Payment</h2>
        <p>Card ending in {order.payment_details.card_last_four_digits}</p>
      </section>

      <Link
        href="/"
        className="mt-6 inline-block text-sm font-medium underline"
      >
        Continue Shopping
      </Link>
    </article>
  );
}
