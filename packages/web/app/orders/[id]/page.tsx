import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import { redirect, notFound } from "next/navigation";
import { getServerSession } from "@/lib/get-server-session";
import { ApiRequestError, fetchOrder } from "@/lib/api";

interface Props {
  params: Promise<{ id: string }>;
}

async function fetchOrderOrNotFound(id: number, cookie: string | null) {
  try {
    return await fetchOrder(
      id,
      cookie ? { headers: { Cookie: cookie } } : undefined,
    );
  } catch (err) {
    if (err instanceof ApiRequestError && err.status === 404) return null;
    throw err;
  }
}

export const metadata: Metadata = { title: "Order Details" };

export default async function OrderDetailPage({ params }: Props) {
  const { id } = await params;
  const session = await getServerSession();

  if (!session) {
    redirect(`/sign-in?redirect=/orders/${id}`);
  }

  const cookie = (await headers()).get("cookie");
  const order = await fetchOrderOrNotFound(parseInt(id, 10), cookie);

  if (!order) notFound();

  return (
    <article aria-label="Order details" className="max-w-2xl">
      <h1 className="text-2xl">Order #{order.id}</h1>

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
        <h2 className="text-lg">Delivered to</h2>
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
        href="/orders"
        className="mt-8 inline-block font-mono text-sm tracking-wide text-secondary underline underline-offset-4"
      >
        Back to Order History
      </Link>
    </article>
  );
}
