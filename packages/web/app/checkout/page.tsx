import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { getServerSession } from "@/lib/get-server-session";
import { fetchSavedAddress } from "@/lib/api";
import { CheckoutFormPage } from "@/app/checkout/_components";

export const metadata: Metadata = { title: "Checkout" };

export default async function CheckoutPage() {
  const session = await getServerSession();

  if (!session) {
    redirect("/sign-in?redirect=/checkout");
  }

  const cookie = (await headers()).get("cookie");
  const savedAddress = await fetchSavedAddress(
    cookie ? { headers: { Cookie: cookie } } : undefined,
  );

  return <CheckoutFormPage savedAddress={savedAddress} />;
}
