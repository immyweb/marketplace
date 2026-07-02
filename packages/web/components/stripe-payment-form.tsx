"use client";

import { CardElement } from "@stripe/react-stripe-js";

export function StripePaymentForm() {
  return (
    <fieldset className="mt-6">
      <legend className="text-lg font-medium">Payment Details</legend>
      <div className="mt-4">
        <label htmlFor="card-element" className="text-sm font-medium">
          Card details
        </label>
        <div
          id="card-element"
          role="group"
          aria-label="Credit or debit card"
          className="mt-1 rounded-md border border-input bg-background px-3 py-2.5 shadow-xs"
        >
          <CardElement
            options={{
              style: { base: { fontSize: "16px" } },
              hidePostalCode: true,
            }}
          />
        </div>
        <p className="mt-2 text-sm text-muted-foreground">
          Test card: 4242 4242 4242 4242 · Any future date · Any CVC
        </p>
      </div>
    </fieldset>
  );
}
