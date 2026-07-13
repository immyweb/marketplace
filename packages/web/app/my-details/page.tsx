import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { getServerSession } from "@/lib/get-server-session";
import { fetchSavedAddress } from "@/lib/api";
import { MyDetailsForm } from "@/app/my-details/_components";

export const metadata: Metadata = { title: "My Details" };

export default async function MyDetailsPage() {
  const session = await getServerSession();

  if (!session) {
    redirect("/sign-in?redirect=/my-details");
  }

  const cookie = (await headers()).get("cookie");
  const savedAddress = await fetchSavedAddress(
    cookie ? { headers: { Cookie: cookie } } : undefined,
  );

  return <MyDetailsForm savedAddress={savedAddress} />;
}
