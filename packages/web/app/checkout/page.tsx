import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getServerSession } from "@/lib/get-server-session";
import { CheckoutFormPage } from "@/app/checkout/_components";

export const metadata: Metadata = { title: "Checkout" };

export default async function CheckoutPage() {
  const session = await getServerSession();

  if (!session) {
    redirect("/sign-in?redirect=/checkout");
  }

  return <CheckoutFormPage />;
}
