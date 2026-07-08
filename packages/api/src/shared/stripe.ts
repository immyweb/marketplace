import Stripe from "stripe";

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2026-06-24.dahlia",
  // Stripe's default Node httpClient uses the raw `http`/`https` modules and
  // waits on low-level socket events, which hang indefinitely when MSW's
  // network interceptor (added for the Resend test harness) is listening —
  // see https://github.com/stripe/stripe-node/issues/2211. The fetch-based
  // client avoids this because MSW bypasses fetch() cleanly.
  httpClient: Stripe.createFetchHttpClient(),
});
