"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { AddressSchema, type AddressInput } from "@marketplace/core";
import {
  Elements,
  useStripe,
  useElements,
  CardElement,
} from "@stripe/react-stripe-js";
import { stripePromise } from "@/app/checkout/_lib";
import { fetchCart, createPaymentIntent, placeOrder } from "@/lib/api";
import { AddressForm } from "./address-form";
import { StripePaymentForm } from "./stripe-payment-form";
import { Button } from "@/components/ui/button";
import type { Cart } from "@marketplace/core";

export type CheckoutFormValues = AddressInput;

function CheckoutForm({ cart }: { cart: Cart }) {
  const stripe = useStripe();
  const elements = useElements();
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<CheckoutFormValues>({
    resolver: zodResolver(AddressSchema),
  });

  async function onSubmit(values: CheckoutFormValues) {
    if (!stripe || !elements || !cart.id) return;
    setSubmitting(true);
    setFormError(null);

    try {
      const { clientSecret } = await createPaymentIntent(cart.id);

      const cardElement = elements.getElement(CardElement);
      if (!cardElement) throw new Error("Card element not mounted");

      const { error, paymentIntent } = await stripe.confirmCardPayment(
        clientSecret,
        {
          payment_method: {
            card: cardElement,
            billing_details: { name: values.name, address: { country: "GB" } },
          },
        },
      );

      if (error || !paymentIntent) {
        setFormError(error?.message ?? "Payment failed. Please try again.");
        return;
      }

      const order = await placeOrder({
        cartId: cart.id,
        paymentIntentId: paymentIntent.id,
        address_details: values,
      });

      router.push(`/order-confirmation/${order.id}`);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      aria-label="Checkout form"
      noValidate
      className="max-w-2xl"
    >
      <h1 className="text-2xl">Checkout</h1>

      <AddressForm register={register} errors={errors} />
      <StripePaymentForm />

      <div className="mt-8 flex items-center justify-between border-t-2 border-primary pt-4">
        <p
          aria-label={`Order total: £${cart.total_price.toFixed(2)}`}
          className="font-display text-lg font-bold tracking-wide uppercase"
        >
          Total: £{cart.total_price.toFixed(2)}
        </p>
        <Button
          type="submit"
          disabled={submitting || !stripe}
          aria-busy={submitting}
        >
          {submitting ? "Processing..." : "Place Order"}
        </Button>
      </div>

      {formError && (
        <p role="alert" className="mt-4 text-sm text-destructive">
          {formError}
        </p>
      )}
    </form>
  );
}

export function CheckoutFormPage() {
  const [cart, setCart] = useState<Cart | null>(null);
  const router = useRouter();

  useEffect(() => {
    fetchCart().then((c) => {
      if (!c.id || c.items.length === 0) {
        router.push("/cart");
        return;
      }
      setCart(c);
    });
  }, [router]);

  if (!cart) return <p aria-busy="true">Loading...</p>;

  return (
    <Elements stripe={stripePromise}>
      <CheckoutForm cart={cart} />
    </Elements>
  );
}
