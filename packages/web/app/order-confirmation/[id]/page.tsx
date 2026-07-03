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
    <article aria-label="Order confirmation" className="relative max-w-2xl">
      <div
        aria-hidden="true"
        className="absolute top-0 right-0 -rotate-6 rounded-sm border-2 border-secondary px-3 py-1 font-mono text-xs font-bold tracking-widest text-secondary uppercase"
      >
        Order Received
      </div>

      <h1 className="text-2xl">Order Confirmed</h1>
      <p className="mt-2 text-muted-foreground">
        Thank you for your order. Your order number is{" "}
        <strong className="font-mono text-foreground">#{order.id}</strong>.
      </p>

      <section
        aria-label="Order summary"
        className="mt-8 border-t border-dashed border-border pt-6"
      >
        <h2 className="text-lg">Order Summary</h2>
        <ul className="mt-3 list-none p-0">
          {order.items.map((item) => (
            <li key={item.product.id} className="py-1 font-mono text-sm">
              {item.product.name} × {item.quantity} — £{item.price.toFixed(2)}
            </li>
          ))}
        </ul>
        <p
          aria-label={`Total: £${order.total_price.toFixed(2)}`}
          className="mt-4 font-display text-lg font-bold tracking-wide uppercase"
        >
          Total: £{order.total_price.toFixed(2)}
        </p>
      </section>

      <section
        aria-label="Delivery details"
        className="mt-6 border-t border-dashed border-border pt-6"
      >
        <h2 className="text-lg">Delivering to</h2>
        <address className="mt-2 leading-relaxed not-italic">
          {order.address_details.name}
          <br />
          {order.address_details.street}
          <br />
          {order.address_details.city}
          <br />
          {order.address_details.postcode}
        </address>
      </section>

      <section
        aria-label="Payment details"
        className="mt-6 border-t border-dashed border-border pt-6"
      >
        <h2 className="text-lg">Payment</h2>
        <p className="mt-2">
          Card ending in {order.payment_details.card_last_four_digits}
        </p>
      </section>

      <Link
        href="/"
        className="mt-8 inline-block font-mono text-sm tracking-wide text-secondary underline underline-offset-4"
      >
        Continue Shopping
      </Link>
    </article>
  );
}
