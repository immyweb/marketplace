import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getServerSession } from "@/lib/get-server-session";
import { fetchOrders } from "@/lib/api";
import { Pagination } from "@/components/ui/pagination";

export const metadata: Metadata = { title: "Order History" };

interface Props {
  searchParams: Promise<{ page?: string }>;
}

export default async function OrdersPage({ searchParams }: Props) {
  const session = await getServerSession();

  if (!session) {
    redirect("/sign-in?redirect=/orders");
  }

  const { page } = await searchParams;
  const currentPage = page ? Number(page) : 1;

  const cookie = (await headers()).get("cookie");
  const { results: orders, totalPages } = await fetchOrders(
    { page: currentPage },
    cookie ? { headers: { Cookie: cookie } } : undefined,
  );

  return (
    <>
      <h1 className="text-2xl">Order History</h1>
      {orders.length === 0 ? (
        <p className="mt-8 text-muted-foreground">
          You haven&apos;t placed any orders yet.{" "}
          <Link
            href="/"
            className="text-secondary underline underline-offset-4"
          >
            Browse products
          </Link>
        </p>
      ) : (
        <>
          <ul
            aria-label="Order history"
            className="mt-8 list-none space-y-1 p-0"
          >
            {orders.map((order) => (
              <li key={order.id}>
                <Link
                  href={`/orders/${order.id}`}
                  className="flex flex-wrap items-baseline gap-x-3 border-b border-dashed border-border py-3 font-mono text-sm hover:text-accent"
                >
                  <span>#{order.id}</span>
                  <span>
                    {new Date(order.created_at).toLocaleDateString("en-GB", {
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                    })}
                  </span>
                  <span>
                    {order.item_count} item{order.item_count !== 1 ? "s" : ""}
                  </span>
                  <span>£{order.total_price.toFixed(2)}</span>
                  <span className="uppercase">{order.status}</span>
                </Link>
              </li>
            ))}
          </ul>
          <Pagination
            page={currentPage}
            totalPages={totalPages}
            buildHref={(p) => (p > 1 ? `/orders?page=${p}` : "/orders")}
          />
        </>
      )}
    </>
  );
}
